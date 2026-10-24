import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '@libs/common';
import { Prisma } from '@generated/prisma';
import { CreateEmergencyNumberDto } from './dto/create-emergency-number.dto';
import { UpdateEmergencyNumberDto } from './dto/update-emergency-number.dto';

@Injectable()
export class EmergencyNumberService {
  constructor(private readonly prisma: PrismaService) {}

  async addEmergencyNumber(countryId: string, dto: CreateEmergencyNumberDto) {
    const country = await this.prisma.exploreCountry.findUnique({
      where: { id: countryId },
    });

    if (!country) {
      throw new NotFoundException('Explore country not found');
    }

    const duplicate = await this.prisma.exploreCountryEmergencyNumber.findFirst(
      {
        where: {
          exploreCountryId: countryId,
          OR: [{ title: dto.title }, { number: dto.number }],
        },
      },
    );

    if (duplicate) {
      throw new ConflictException(
        'An emergency number with this title or number already exists for this country',
      );
    }

    try {
      const emergencyNumber =
        await this.prisma.exploreCountryEmergencyNumber.create({
          data: {
            title: dto.title,
            number: dto.number,
            exploreCountryId: countryId,
          },
        });

      return {
        message: 'Emergency number added successfully',
        data: emergencyNumber,
      };
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ) {
        throw new ConflictException(
          'An emergency number with this title or number already exists for this country',
        );
      }
      throw err;
    }
  }

  async updateEmergencyNumber(
    emergencyNumberId: string,
    dto: UpdateEmergencyNumberDto,
  ) {
    const emergencyNumber =
      await this.prisma.exploreCountryEmergencyNumber.findUnique({
        where: { id: emergencyNumberId },
      });

    if (!emergencyNumber) {
      throw new NotFoundException('Emergency number not found');
    }

    const duplicate = await this.prisma.exploreCountryEmergencyNumber.findFirst(
      {
        where: {
          exploreCountryId: emergencyNumber.exploreCountryId,
          id: { not: emergencyNumberId },
          OR: [{ title: dto.title }, { number: dto.number }],
        },
      },
    );

    if (duplicate) {
      throw new ConflictException(
        'An emergency number with this title or number already exists for this country',
      );
    }

    try {
      const updated = await this.prisma.exploreCountryEmergencyNumber.update({
        where: { id: emergencyNumberId },
        data: { title: dto.title, number: dto.number },
      });

      return {
        message: 'Emergency number updated successfully',
        data: updated,
      };
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ) {
        throw new ConflictException(
          'An emergency number with this title or number already exists for this country',
        );
      }
      throw err;
    }
  }

  async deleteEmergencyNumber(emergencyNumberId: string) {
    const emergencyNumber =
      await this.prisma.exploreCountryEmergencyNumber.findUnique({
        where: { id: emergencyNumberId },
      });

    if (!emergencyNumber) {
      throw new NotFoundException('Emergency number not found');
    }

    await this.prisma.exploreCountryEmergencyNumber.delete({
      where: { id: emergencyNumberId },
    });

    return { message: 'Emergency number deleted successfully' };
  }
}
