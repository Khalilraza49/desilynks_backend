import { IsNotEmpty, IsUUID } from 'class-validator';

export class CastVoteDto {
  @IsNotEmpty()
  @IsUUID('4')
  optionId: string;
}
