import { Transform } from 'class-transformer';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class LoginDto {
  @Transform(({ value }) => {
    const identifier = value?.trim();
    return identifier?.includes('@') ? identifier.toLowerCase() : identifier;
  })
  @IsString()
  @IsNotEmpty({ message: 'Email or phone number is required' })
  @MaxLength(100)
  emailOrPhoneNumber: string;

  @IsString()
  @IsNotEmpty()
  password: string;
}
