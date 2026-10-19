import { IsString, Length } from 'class-validator';

export class RejectTherapistDto {
  @IsString() @Length(3, 500) reason!: string;
}
