import { IsEnum, IsUUID } from 'class-validator';

export enum DeleteScope {
  FOR_ME = 'FOR_ME',
  FOR_EVERYONE = 'FOR_EVERYONE',
}

export class DeleteMessageDto {
  @IsUUID()
  messageId: string;

  @IsEnum(DeleteScope)
  scope: DeleteScope;
}
