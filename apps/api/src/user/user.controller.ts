import {
  Controller,
  Get,
  Patch,
  Delete,
  Body,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  Param,
  ParseUUIDPipe,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Throttle } from '@nestjs/throttler';
import { UserService } from './user.service';
import { GetUser } from '../auth/decorators/get-user.decorator';
import type { User } from '@generated/prisma';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { UpdateUserDto } from './dto/update-user.dto';
import { UpdateProfilePhotoDto } from './dto/update-profile-photo.dto';
import { DeleteAccountDto } from './dto/delete-account.dto';
import {
  tempStorage,
  imageFileFilter,
  MAX_PROFILE_PHOTO_SIZE,
  MAX_AVATAR_DIMENSION,
  OptimizeImagePipe,
  SENSITIVE_ACTION_THROTTLE,
  UPLOAD_THROTTLE,
} from '@libs/common';

@Controller('user')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  async getMe(@GetUser() user: User) {
    return this.userService.getUser(user);
  }

  @Get(':id')
  async getUserById(@Param('id', ParseUUIDPipe) id: string) {
    return this.userService.getUserById(id);
  }

  @Patch()
  @UseGuards(JwtAuthGuard)
  async updateUser(@GetUser('id') userId: string, @Body() dto: UpdateUserDto) {
    return this.userService.updateUser(userId, dto);
  }

  @Delete()
  @Throttle(SENSITIVE_ACTION_THROTTLE)
  @UseGuards(JwtAuthGuard)
  async deleteAccount(
    @GetUser('id') userId: string,
    @Body() dto: DeleteAccountDto,
  ) {
    return this.userService.deleteAccount(userId, dto);
  }

  @Patch('profile-photo')
  @Throttle(UPLOAD_THROTTLE)
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(
    FileInterceptor('profilePhoto', {
      storage: tempStorage,
      fileFilter: imageFileFilter,
      limits: { fileSize: MAX_PROFILE_PHOTO_SIZE },
    }),
  )
  async updateProfilePhoto(
    @GetUser() user: User,
    @Body() dto: UpdateProfilePhotoDto,
    @UploadedFile(new OptimizeImagePipe({ profilePhoto: MAX_AVATAR_DIMENSION }))
    file?: Express.Multer.File,
  ) {
    return this.userService.updateProfilePhoto(user, dto, file);
  }
}
