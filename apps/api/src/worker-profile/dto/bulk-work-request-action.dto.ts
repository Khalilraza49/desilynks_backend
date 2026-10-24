import { Transform } from 'class-transformer';
import { IsArray, ArrayMinSize, IsUUID } from 'class-validator';

export class BulkWorkRequestActionDto {
  @Transform(({ value }) => {
    if (Array.isArray(value)) return value;
    if (typeof value === 'string') {
      try {
        const parsed = JSON.parse(value);
        return Array.isArray(parsed) ? parsed : value;
      } catch {
        return value;
      }
    }

    return value;
  })
  @IsArray()
  @ArrayMinSize(1)
  @IsUUID('4', { each: true })
  ids: string[];
}
