import { IsArray, IsBoolean, IsEnum, IsOptional, IsString, Length } from 'class-validator';
import { CommunicationMode } from '../../../prisma/generated/client/client.js';

export class UpdatePatientProfileDto {
  @IsOptional() @IsString() @Length(2, 60) preferredDisplayName?: string;
  @IsOptional() @IsString() @Length(2, 30) ageRange?: string;
  @IsOptional() @IsEnum(CommunicationMode) communicationPreference?: CommunicationMode;
  @IsOptional() @IsArray() @IsString({ each: true }) supportGoals?: string[];
  @IsOptional() @IsBoolean() emailNotifications?: boolean;
  @IsOptional() @IsBoolean() pushNotifications?: boolean;
  @IsOptional() @IsBoolean() completeOnboarding?: boolean;
}
