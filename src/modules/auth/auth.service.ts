import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { hash, verify } from 'argon2';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import {
  AccountStatus,
  UserRole,
  VerificationTokenPurpose,
} from '../../../prisma/generated/client/client.js';
import { DatabaseService } from '../../infrastructure/database/database.service.js';
import { EncryptionService } from '../../infrastructure/encryption/encryption.service.js';
import { AuditService } from '../../infrastructure/audit/audit.service.js';
import { EmailService } from '../../infrastructure/email/email.service.js';
import { RegistrationRole, type LoginDto, type RegisterDto } from './auth.dto.js';

interface RefreshClaims {
  sub: string;
  jti: string;
  type: 'refresh';
}

@Injectable()
export class AuthService {
  constructor(
    private readonly database: DatabaseService,
    private readonly encryption: EncryptionService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly audit: AuditService,
    private readonly emailService: EmailService,
  ) {}

  async register(input: RegisterDto) {
    if (!input.acceptedTerms) throw new BadRequestException('Terms must be accepted');
    const dateOfBirth = new Date(input.dateOfBirth);
    if (!this.isAtLeast18(dateOfBirth)) {
      throw new BadRequestException('Sona accounts are currently available to adults aged 18 and over');
    }
    const email = input.email.trim().toLowerCase();
    const emailBlindIndex = this.encryption.blindIndex(email);
    if (await this.database.user.findUnique({ where: { emailBlindIndex }, select: { id: true } })) {
      throw new ConflictException('An account with this email already exists');
    }
    const fullName = input.fullName.trim();
    const [firstName, ...lastNameParts] = fullName.split(/\s+/);
    const role = input.role === RegistrationRole.THERAPIST ? UserRole.THERAPIST : UserRole.PATIENT;
    const user = await this.database.user.create({
      data: {
        emailBlindIndex,
        encryptedEmail: this.encryption.encrypt(email),
        emailDomain: email.slice(email.lastIndexOf('@') + 1),
        encryptedFullName: this.encryption.encrypt(fullName),
        passwordHash: await hash(input.password),
        roles: [role],
        alias: this.createAlias(),
        termsAcceptedAt: new Date(),
        countryCode: input.countryCode,
        timezone: input.timezone,
        dateOfBirth,
        patient:
          role === UserRole.PATIENT
            ? {
                create: {
                  medicalRecordNumber: `SON-${randomBytes(6).toString('hex').toUpperCase()}`,
                  encryptedFirstName: this.encryption.encrypt(firstName ?? fullName),
                  encryptedLastName: this.encryption.encrypt(lastNameParts.join(' ')),
                  dateOfBirth,
                },
              }
            : undefined,
        provider:
          role === UserRole.THERAPIST
            ? {
                create: {
                  encryptedDisplayName: this.encryption.encrypt(fullName),
                  licenseNumber: this.encryption.blindIndex(input.licenseNumber!),
                  licenseType: input.licenseType,
                  specialty: input.specialty,
                  countryCode: input.countryCode,
                  timezone: input.timezone,
                },
              }
            : undefined,
      },
      select: { id: true, roles: true, status: true },
    });
    const verificationToken = await this.createVerificationToken(user.id);
    await this.emailService.sendLifecycleEmail({
      recipient: email,
      token: verificationToken,
      type: 'verify-email',
    });
    await this.audit.write({
      actorId: user.id,
      action: 'user.registered',
      resourceType: 'user',
      resourceId: user.id,
      outcome: 'success',
      metadata: { role },
    });
    return {
      userId: user.id,
      status: user.status,
      verificationRequired: true,
      ...(this.config.get('NODE_ENV') !== 'production'
        ? { developmentVerificationToken: verificationToken }
        : {}),
    };
  }

  async verifyEmail(rawToken: string) {
    const token = await this.database.verificationToken.findUnique({
      where: { tokenHash: this.hashToken(rawToken) },
      include: { user: { select: { id: true, roles: true } } },
    });
    if (
      !token ||
      token.purpose !== VerificationTokenPurpose.EMAIL_VERIFICATION ||
      token.consumedAt ||
      token.expiresAt <= new Date()
    ) {
      throw new BadRequestException('Verification link is invalid or expired');
    }
    const nextStatus = token.user.roles.includes(UserRole.THERAPIST)
      ? AccountStatus.PENDING_REVIEW
      : AccountStatus.ACTIVE;
    await this.database.$transaction([
      this.database.verificationToken.update({ where: { id: token.id }, data: { consumedAt: new Date() } }),
      this.database.user.update({
        where: { id: token.user.id },
        data: { emailVerifiedAt: new Date(), status: nextStatus },
      }),
    ]);
    await this.audit.write({
      actorId: token.user.id,
      action: 'user.email_verified',
      resourceType: 'user',
      resourceId: token.user.id,
      outcome: 'success',
    });
    return { verified: true, status: nextStatus };
  }

  async resendVerification(emailInput: string) {
    const user = await this.database.user.findUnique({
      where: { emailBlindIndex: this.encryption.blindIndex(emailInput) },
      select: { id: true, emailVerifiedAt: true, encryptedEmail: true },
    });
    let developmentVerificationToken: string | undefined;
    if (user && !user.emailVerifiedAt) {
      await this.database.verificationToken.updateMany({
        where: { userId: user.id, purpose: VerificationTokenPurpose.EMAIL_VERIFICATION, consumedAt: null },
        data: { consumedAt: new Date() },
      });
      developmentVerificationToken = await this.createVerificationToken(user.id);
      await this.emailService.sendLifecycleEmail({
        recipient: this.encryption.decrypt(user.encryptedEmail),
        token: developmentVerificationToken,
        type: 'verify-email',
      });
    }
    return {
      message: 'If an unverified account exists, a new verification email has been requested',
      ...(this.config.get('NODE_ENV') !== 'production' && developmentVerificationToken
        ? { developmentVerificationToken }
        : {}),
    };
  }

  async forgotPassword(emailInput: string) {
    const user = await this.database.user.findUnique({
      where: { emailBlindIndex: this.encryption.blindIndex(emailInput) },
      select: { id: true, encryptedEmail: true },
    });
    let developmentResetToken: string | undefined;
    if (user) {
      await this.database.verificationToken.updateMany({
        where: { userId: user.id, purpose: VerificationTokenPurpose.PASSWORD_RESET, consumedAt: null },
        data: { consumedAt: new Date() },
      });
      developmentResetToken = await this.createLifecycleToken(
        user.id,
        VerificationTokenPurpose.PASSWORD_RESET,
        60 * 60_000,
      );
      await this.emailService.sendLifecycleEmail({
        recipient: this.encryption.decrypt(user.encryptedEmail),
        token: developmentResetToken,
        type: 'reset-password',
      });
      await this.audit.write({
        actorId: user.id,
        action: 'user.password_reset_requested',
        resourceType: 'user',
        resourceId: user.id,
        outcome: 'success',
      });
    }
    return {
      message: 'If an account exists, password reset instructions have been requested',
      ...(this.config.get('NODE_ENV') !== 'production' && developmentResetToken
        ? { developmentResetToken }
        : {}),
    };
  }

  async resetPassword(rawToken: string, newPassword: string) {
    const token = await this.database.verificationToken.findUnique({
      where: { tokenHash: this.hashToken(rawToken) },
      select: { id: true, userId: true, purpose: true, consumedAt: true, expiresAt: true },
    });
    if (
      !token ||
      token.purpose !== VerificationTokenPurpose.PASSWORD_RESET ||
      token.consumedAt ||
      token.expiresAt <= new Date()
    ) {
      throw new BadRequestException('Password reset link is invalid or expired');
    }
    await this.database.$transaction([
      this.database.verificationToken.update({ where: { id: token.id }, data: { consumedAt: new Date() } }),
      this.database.user.update({
        where: { id: token.userId },
        data: { passwordHash: await hash(newPassword), failedLoginAttempts: 0, lockedUntil: null },
      }),
      this.database.refreshSession.updateMany({
        where: { userId: token.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);
    await this.audit.write({
      actorId: token.userId,
      action: 'user.password_reset_completed',
      resourceType: 'user',
      resourceId: token.userId,
      outcome: 'success',
    });
    return { reset: true };
  }

  async login(input: LoginDto) {
    const emailBlindIndex = this.encryption.blindIndex(input.email);
    const user = await this.database.user.findUnique({ where: { emailBlindIndex } });
    const valid = user ? await verify(user.passwordHash, input.password) : false;
    if (!user || !valid || (user.lockedUntil && user.lockedUntil > new Date())) {
      if (user) await this.recordFailedLogin(user.id, user.failedLoginAttempts);
      throw new UnauthorizedException('Invalid credentials');
    }
    if (!user.emailVerifiedAt) throw new ForbiddenException('Email verification is required');
    if (user.status === AccountStatus.SUSPENDED || user.status === AccountStatus.DELETION_PENDING) {
      throw new ForbiddenException('This account is not available');
    }
    await this.database.user.update({
      where: { id: user.id },
      data: { failedLoginAttempts: 0, lockedUntil: null, lastLoginAt: new Date() },
    });
    await this.audit.write({
      actorId: user.id,
      action: 'user.login',
      resourceType: 'session',
      outcome: 'success',
    });
    return this.issueTokenPair(user);
  }

  async refresh(rawToken: string) {
    const claims = await this.verifyRefreshToken(rawToken);
    const session = await this.database.refreshSession.findUnique({
      where: { id: claims.jti },
      include: { user: { select: { id: true, roles: true, status: true } } },
    });
    if (
      !session ||
      session.userId !== claims.sub ||
      session.revokedAt ||
      session.expiresAt <= new Date() ||
      session.tokenHash !== this.hashToken(rawToken)
    ) {
      throw new UnauthorizedException('Invalid refresh token');
    }
    const replacementId = randomUUID();
    const tokenPair = await this.buildTokenPair(session.user, replacementId);
    await this.database.$transaction([
      this.database.refreshSession.update({
        where: { id: session.id },
        data: { revokedAt: new Date(), lastUsedAt: new Date(), replacedById: replacementId },
      }),
      this.database.refreshSession.create({
        data: {
          id: replacementId,
          userId: session.userId,
          tokenHash: this.hashToken(tokenPair.refreshToken),
          expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60_000),
        },
      }),
    ]);
    return tokenPair;
  }

  async logout(rawToken: string) {
    try {
      const claims = await this.verifyRefreshToken(rawToken);
      await this.database.refreshSession.updateMany({
        where: { id: claims.jti, userId: claims.sub, tokenHash: this.hashToken(rawToken), revokedAt: null },
        data: { revokedAt: new Date(), lastUsedAt: new Date() },
      });
    } catch {
      // Logout is idempotent and intentionally does not reveal token validity.
    }
  }

  me(userId: string) {
    return this.database.user.findUniqueOrThrow({
      where: { id: userId },
      select: {
        id: true,
        alias: true,
        roles: true,
        status: true,
        emailVerifiedAt: true,
        countryCode: true,
        timezone: true,
        createdAt: true,
        patient: { select: { onboardingStage: true, onboardingCompletedAt: true } },
        provider: {
          select: { onboardingStage: true, onboardingCompletedAt: true, verificationStatus: true },
        },
      },
    });
  }

  private async recordFailedLogin(id: string, attempts: number) {
    const next = attempts + 1;
    await this.database.user.update({
      where: { id },
      data: { failedLoginAttempts: next, lockedUntil: next >= 5 ? new Date(Date.now() + 15 * 60_000) : null },
    });
    await this.audit.write({
      actorId: id,
      action: 'user.login_failed',
      resourceType: 'session',
      outcome: 'failure',
    });
  }

  private async issueTokenPair(user: { id: string; roles: UserRole[]; status: AccountStatus }) {
    const sessionId = randomUUID();
    const pair = await this.buildTokenPair(user, sessionId);
    await this.database.refreshSession.create({
      data: {
        id: sessionId,
        userId: user.id,
        tokenHash: this.hashToken(pair.refreshToken),
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60_000),
      },
    });
    return pair;
  }

  private async buildTokenPair(
    user: { id: string; roles: UserRole[]; status: AccountStatus },
    sessionId: string,
  ) {
    const [accessToken, refreshToken] = await Promise.all([
      this.jwt.signAsync(
        { sub: user.id, roles: user.roles, status: user.status, type: 'access' },
        { expiresIn: '15m' },
      ),
      this.jwt.signAsync(
        { sub: user.id, jti: sessionId, type: 'refresh' },
        { secret: this.config.getOrThrow('JWT_REFRESH_SECRET'), expiresIn: '30d' },
      ),
    ]);
    return { accessToken, refreshToken, tokenType: 'Bearer', expiresIn: 900 };
  }

  private verifyRefreshToken(token: string) {
    return this.jwt.verifyAsync<RefreshClaims>(token, {
      secret: this.config.getOrThrow('JWT_REFRESH_SECRET'),
    });
  }

  private async createVerificationToken(userId: string) {
    return this.createLifecycleToken(userId, VerificationTokenPurpose.EMAIL_VERIFICATION, 24 * 60 * 60_000);
  }

  private async createLifecycleToken(userId: string, purpose: VerificationTokenPurpose, lifetimeMs: number) {
    const rawToken = randomBytes(32).toString('base64url');
    await this.database.verificationToken.create({
      data: {
        userId,
        purpose,
        tokenHash: this.hashToken(rawToken),
        expiresAt: new Date(Date.now() + lifetimeMs),
      },
    });
    return rawToken;
  }

  private hashToken(value: string) {
    return createHash('sha256').update(value).digest('hex');
  }

  private createAlias() {
    const adjectives = ['Calm', 'Brave', 'Kind', 'Quiet', 'Bright', 'Steady'];
    const nouns = ['River', 'Cedar', 'Sky', 'Harbor', 'Willow', 'Dawn'];
    return `${adjectives[Math.floor(Math.random() * adjectives.length)]}${
      nouns[Math.floor(Math.random() * nouns.length)]
    }${randomBytes(3).toString('hex')}`;
  }

  private isAtLeast18(dateOfBirth: Date) {
    const today = new Date();
    const cutoff = new Date(Date.UTC(today.getUTCFullYear() - 18, today.getUTCMonth(), today.getUTCDate()));
    return dateOfBirth <= cutoff;
  }
}
