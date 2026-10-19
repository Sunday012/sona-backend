import 'reflect-metadata';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { randomUUID } from 'node:crypto';
import { AppModule } from './app.module.js';

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({
      bodyLimit: 1024 * 1024,
      trustProxy: (_address, hop) => hop === 0,
      genReqId: () => randomUUID(),
    }),
    { bufferLogs: true, rawBody: true },
  );
  const config = app.get(ConfigService);
  const origins = config
    .getOrThrow<string>('ALLOWED_ORIGINS')
    .split(',')
    .map((value) => value.trim());
  const trustedHosts = new Set(
    config
      .getOrThrow<string>('TRUSTED_HOSTS')
      .split(',')
      .map((value) => value.trim()),
  );
  const fastify = app.getHttpAdapter().getInstance();

  fastify.addHook(
    'onRequest',
    async (
      request: { hostname: string },
      reply: { code: (status: number) => { send: (body: unknown) => void } },
    ) => {
      if (!trustedHosts.has(request.hostname)) reply.code(400).send({ message: 'Untrusted host' });
    },
  );
  fastify.addHook(
    'onSend',
    async (_request: unknown, reply: { header: (name: string, value: string) => void }, payload: unknown) => {
      reply.header('X-Content-Type-Options', 'nosniff');
      reply.header('X-Frame-Options', 'DENY');
      reply.header('Referrer-Policy', 'no-referrer');
      reply.header('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
      reply.header('Content-Security-Policy', "default-src 'none'; frame-ancestors 'none'; base-uri 'none'");
      reply.header('Cache-Control', 'no-store');
      return payload;
    },
  );

  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
  app.enableCors({
    origin: origins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    allowedHeaders: ['content-type', 'authorization', 'x-csrf-token', 'x-request-id'],
  });
  app.enableShutdownHooks();

  if (config.get('NODE_ENV') !== 'production') {
    const document = SwaggerModule.createDocument(
      app,
      new DocumentBuilder()
        .setTitle('Sona API')
        .setDescription('Healthcare platform API. Do not place real PHI in development environments.')
        .setVersion('1.0')
        .addBearerAuth()
        .build(),
    );
    SwaggerModule.setup('api/v1/docs', app, document, { jsonDocumentUrl: 'api/v1/openapi.json' });
  }

  const port = config.get<number>('PORT') ?? config.get<number>('API_PORT', 8080);
  await app.listen(port, '0.0.0.0');
}

void bootstrap();
