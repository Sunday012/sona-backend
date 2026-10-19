import { IsBoolean, IsEnum, IsInt, IsOptional, IsString, Length, Max, Min } from 'class-validator';
import { CommunicationMode, IntakeCategory } from '../../../prisma/generated/client/client.js';

export class RequestImmediateSessionDto {
  @IsEnum(IntakeCategory) category!: IntakeCategory;
  @IsEnum(CommunicationMode) preferredMode!: CommunicationMode;
  @IsOptional() @IsString() @Length(1, 2000) context?: string;
}

export class RateSessionDto {
  @IsInt() @Min(1) @Max(5) rating!: number;
}

export class SaveTherapistNoteDto {
  @IsString() @Length(1, 10_000) note!: string;
  @IsOptional() @IsBoolean() finalized?: boolean;
}
