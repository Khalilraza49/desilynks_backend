import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { AdminService } from './admin.service';
import { GetAdmin } from '../auth/decorators/get-admin.decorator';
import type { Admin } from '@generated/prisma';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { UpdateAdminDto } from './dto/update-admin.dto';

@Controller('admin/profile')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  async getMe(@GetAdmin() admin: Admin) {
    return this.adminService.getAdmin(admin);
  }

  @Patch()
  @UseGuards(JwtAuthGuard)
  async updateAdmin(
    @GetAdmin('id') adminId: string,
    @Body() dto: UpdateAdminDto,
  ) {
    return this.adminService.updateAdmin(adminId, dto);
  }
}
