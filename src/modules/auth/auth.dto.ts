import {
  IsBoolean,
  IsEmail,
  IsEnum,
  IsISO8601,
  IsOptional,
  IsString,
  Length,
  Matches,
  MinLength,
  ValidateIf,
} from 'class-validator';

export enum RegistrationRole {
  PATIENT = 'PATIENT',
  THERAPIST = 'THERAPIST',
}

export class RegisterDto {
  @IsEmail() email!: string;
  @IsString() @MinLength(12) password!: string;
  @IsString() @Length(2, 120) fullName!: string;
  @IsEnum(RegistrationRole) role!: RegistrationRole;
  @IsISO8601({ strict: true }) dateOfBirth!: string;
  @IsString() @Matches(/^[A-Z]{2}$/) countryCode!: string;
  @IsString() @Length(1, 64) timezone!: string;
  @IsBoolean() acceptedTerms!: boolean;

  @ValidateIf((input: RegisterDto) => input.role === RegistrationRole.THERAPIST)
  @IsString()
  @Length(2, 80)
  licenseNumber?: string;

  @ValidateIf((input: RegisterDto) => input.role === RegistrationRole.THERAPIST)
  @IsString()
  @Length(2, 80)
  licenseType?: string;

  @IsOptional() @IsString() @Length(2, 100) specialty?: string;
}

export class LoginDto {
  @IsEmail() email!: string;
  @IsString() @MinLength(1) password!: string;
}

export class VerifyEmailDto {
  @IsString() @MinLength(32) token!: string;
}

export class ResendVerificationDto {
  @IsEmail() email!: string;
}

export class RefreshTokenDto {
  @IsString() @MinLength(32) refreshToken!: string;
}

export class ForgotPasswordDto {
  @IsEmail() email!: string;
}

export class ResetPasswordDto {
  @IsString() @MinLength(32) token!: string;
  @IsString() @MinLength(12) newPassword!: string;
}
