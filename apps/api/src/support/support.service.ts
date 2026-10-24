import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '@libs/common';
import { CreateSupportFormDto } from './dto/create-support-form.dto';

@Injectable()
export class SupportService {
  private readonly logger = new Logger(SupportService.name);

  constructor(private readonly prisma: PrismaService) {}

  async createSupportForm(
    userId: string | undefined,
    dto: CreateSupportFormDto,
  ) {
    try {
      const supportForm = await this.prisma.userSupportForm.create({
        data: {
          userId,
          name: dto.name,
          email: dto.email,
          message: dto.message,
        },
      });

      return {
        message: 'Support form submitted successfully',
        data: { id: supportForm.id, status: supportForm.status },
      };
    } catch (error) {
      this.logger.error(`Error creating support form: ${error.message}`);
      throw new InternalServerErrorException('Failed to submit support form');
    }
  }
}
