import { Injectable } from '@nestjs/common';
import type { Admin } from '@generated/prisma';
import { PrismaService } from '@libs/common';
import { UpdateAdminDto } from './dto/update-admin.dto';

@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

  async getAdmin(admin: Admin) {
    return {
      admin,
    };
  }

  async updateAdmin(adminId: string, dto: UpdateAdminDto) {
    const { firstName, lastName } = dto;

    const updatedAdmin = await this.prisma.admin.update({
      where: {
        id: adminId,
      },
      data: {
        firstName,
        lastName,
      },
    });

    const { password: _password, ...safeAdmin } = updatedAdmin;

    return {
      message: 'Admin updated successfully',
      admin: safeAdmin,
    };
  }
}
