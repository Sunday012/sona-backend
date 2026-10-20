import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { validateEnvironment } from './common/config/environment.js';
import { AccessTokenGuard } from './common/guards/access-token.guard.js';
import { RolesGuard } from './common/guards/roles.guard.js';
import { AuditInterceptor } from './common/interceptors/audit.interceptor.js';
import { AuditModule } from './infrastructure/audit/audit.module.js';
import { DatabaseModule } from './infrastructure/database/database.module.js';
import { EncryptionModule } from './infrastructure/encryption/encryption.module.js';
import { EmailModule } from './infrastructure/email/email.module.js';
import { AdminModule } from './modules/admin/admin.module.js';
import { AuthModule } from './modules/auth/auth.module.js';
import { HealthModule } from './modules/health/health.module.js';
import { PatientsModule } from './modules/patients/patients.module.js';
import { SessionsModule } from './modules/sessions/sessions.module.js';
import { TherapistsModule } from './modules/therapists/therapists.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateEnvironment,
      envFilePath: ['.env'],
    }),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }]),
    JwtModule.registerAsync({
      global: true,
      useFactory: (config: ConfigService) => ({ secret: config.getOrThrow('JWT_ACCESS_SECRET') }),
      inject: [ConfigService],
    }),
    DatabaseModule,
    EncryptionModule,
    EmailModule,
    AuditModule,
    HealthModule,
    AuthModule,
    AdminModule,
    PatientsModule,
    TherapistsModule,
    SessionsModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: AccessTokenGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_INTERCEPTOR, useClass: AuditInterceptor },
  ],
})
export class AppModule {}
