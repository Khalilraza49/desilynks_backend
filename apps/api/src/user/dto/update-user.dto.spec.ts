import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { UpdateUserDto } from './update-user.dto';

describe('UpdateUserDto', () => {
  // Same options as the global pipe in apps/api/src/main.ts
  const pipe = new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
    transformOptions: {
      enableImplicitConversion: true,
    },
  });

  const validBody = {
    firstName: 'John',
    lastName: 'Doe',
    gender: 'male',
    dateOfBirth: '1990-01-01',
    phoneNumber: '+14155550100',
    streetAddress: 'Main Street 1',
    postalCode: '10115',
    city: 'Berlin',
    province: 'Berlin',
    country: 'Germany',
  };

  const validate = (body: Record<string, unknown>): Promise<UpdateUserDto> =>
    pipe.transform(body, { type: 'body', metatype: UpdateUserDto });

  it('should accept the editable fields', async () => {
    await expect(validate(validBody)).resolves.toBeInstanceOf(UpdateUserDto);
  });

  it('should accept omission of both optional address fields', async () => {
    const body: Record<string, unknown> = { ...validBody };
    delete body.streetAddress;
    delete body.postalCode;

    const result = await validate(body);

    expect(result.streetAddress).toBeUndefined();
    expect(result.postalCode).toBeUndefined();
  });

  it('should accept null for both optional address fields', async () => {
    const result = await validate({
      ...validBody,
      streetAddress: null,
      postalCode: null,
    });

    expect(result.streetAddress).toBeNull();
    expect(result.postalCode).toBeNull();
  });

  describe.each(['streetAddress', 'postalCode'] as const)('%s', (field) => {
    it('should accept omission independently', async () => {
      const body: Record<string, unknown> = { ...validBody };
      delete body[field];

      expect((await validate(body))[field]).toBeUndefined();
    });

    it('should accept null independently', async () => {
      expect(
        (await validate({ ...validBody, [field]: null }))[field],
      ).toBeNull();
    });

    it('should trim supplied strings', async () => {
      const result = await validate({ ...validBody, [field]: '  value  ' });

      expect(result[field]).toBe('value');
    });

    it.each(['', '   ', 123, false, {}, []])(
      'should reject invalid input %j',
      async (value) => {
        await expect(
          validate({ ...validBody, [field]: value }),
        ).rejects.toThrow(BadRequestException);
      },
    );
  });

  it.each(['firstName', 'city', 'province', 'country'])(
    'should still require %s',
    async (field) => {
      const body: Record<string, unknown> = { ...validBody };
      delete body[field];

      await expect(validate(body)).rejects.toThrow(BadRequestException);
    },
  );

  it.each([
    ['email', 'new@example.com'],
    ['password', 'new-password'],
    ['status', 'ACTIVE'],
  ])('should reject the non-editable field "%s"', async (field, value) => {
    await expect(validate({ ...validBody, [field]: value })).rejects.toThrow(
      BadRequestException,
    );
  });
});
