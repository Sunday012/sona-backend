import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  Length,
  Max,
  Min,
} from 'class-validator';
import { CredentialType } from '../../../prisma/generated/client/client.js';

export class UpdateTherapistProfileDto {
  @IsOptional() @IsString() @Length(2, 100) specialty?: string;
  @IsOptional() @IsInt() @Min(0) @Max(80) yearsExperience?: number;
  @IsOptional() @IsArray() @IsString({ each: true }) specializations?: string[];
  @IsOptional() @IsArray() @IsString({ each: true }) languages?: string[];
  @IsOptional() @IsBoolean() isAvailable?: boolean;
  @IsOptional() @IsBoolean() completeOnboarding?: boolean;
}

export class RegisterCredentialDto {
  @IsEnum(CredentialType) type!: CredentialType;
  @IsString() @Length(3, 500) objectKey!: string;
  @IsString() @Length(1, 255) originalName!: string;
  @IsString() @Length(3, 100) mimeType!: string;
  @IsString() @Length(32, 128) checksum!: string;
}

export class CreateAvailabilitySlotDto {
  @IsISO8601({ strict: true }) startsAt!: string;
  @IsISO8601({ strict: true }) endsAt!: string;
}
