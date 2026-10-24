import {
  Body,
  Controller,
  Patch,
  Param,
  ParseUUIDPipe,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
  ParseFilePipe,
  Get,
  Query,
  Delete,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../../auth/jwt.guard';
import { GetUser } from '../../auth/decorators/get-user.decorator';
import { EventService } from './event.service';
import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';
import { GetEventsQueryDto } from './dto/get-events-query.dto';
import {
  tempStorage,
  imageFileFilter,
  MAX_COMMUNITY_EVENT_BANNER_SIZE,
  MAX_BANNER_DIMENSION,
  OptimizeImagePipe,
  UPLOAD_THROTTLE,
} from '@libs/common';

@Controller('community/event')
export class EventController {
  constructor(private readonly eventService: EventService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @Throttle(UPLOAD_THROTTLE)
  @UseInterceptors(
    FileInterceptor('banner', {
      storage: tempStorage,
      fileFilter: imageFileFilter,
      limits: { fileSize: MAX_COMMUNITY_EVENT_BANNER_SIZE },
    }),
  )
  async createEvent(
    @GetUser('id') userId: string,
    @Body() dto: CreateEventDto,
    @UploadedFile(
      new ParseFilePipe({
        fileIsRequired: true,
      }),
      new OptimizeImagePipe({ banner: MAX_BANNER_DIMENSION }),
    )
    banner: Express.Multer.File,
  ) {
    return this.eventService.createEvent(userId, dto, banner);
  }

  @Patch(':id/banner')
  @UseGuards(JwtAuthGuard)
  @Throttle(UPLOAD_THROTTLE)
  @UseInterceptors(
    FileInterceptor('banner', {
      storage: tempStorage,
      fileFilter: imageFileFilter,
      limits: { fileSize: MAX_COMMUNITY_EVENT_BANNER_SIZE },
    }),
  )
  async updateEventBanner(
    @GetUser('id') userId: string,
    @Param('id', ParseUUIDPipe) eventId: string,
    @UploadedFile(
      new ParseFilePipe({
        fileIsRequired: true,
      }),
      new OptimizeImagePipe({ banner: MAX_BANNER_DIMENSION }),
    )
    banner: Express.Multer.File,
  ) {
    return this.eventService.updateEventBanner(userId, eventId, banner);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  async updateEventDetails(
    @GetUser('id') userId: string,
    @Param('id', ParseUUIDPipe) eventId: string,
    @Body() dto: UpdateEventDto,
  ) {
    return this.eventService.updateEventDetails(userId, eventId, dto);
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  async getPublicEventFeed(
    @GetUser('id') userId: string,
    @Query() query: GetEventsQueryDto,
  ) {
    return this.eventService.getPublicEventFeed(userId, query);
  }

  @Get('organizer-groups')
  @UseGuards(JwtAuthGuard)
  async getOrganizerGroups(@GetUser('id') userId: string) {
    return this.eventService.getOrganizerGroups(userId);
  }

  @Get('user/:userId/interested')
  @UseGuards(JwtAuthGuard)
  async getUserInterestedEvents(
    @GetUser('id') requesterId: string,
    @Param('userId', ParseUUIDPipe) userId: string,
    @Query() query: GetEventsQueryDto,
  ) {
    return this.eventService.getUserInterestedEvents(
      requesterId,
      userId,
      query,
    );
  }

  @Get('user/:userId')
  @UseGuards(JwtAuthGuard)
  async getUserEvents(
    @GetUser('id') requesterId: string,
    @Param('userId', ParseUUIDPipe) userId: string,
    @Query() query: GetEventsQueryDto,
  ) {
    return this.eventService.getUserEvents(requesterId, userId, query);
  }

  @Get('group/:groupId')
  @UseGuards(JwtAuthGuard)
  async getGroupEvents(
    @GetUser('id') requesterId: string,
    @Param('groupId', ParseUUIDPipe) groupId: string,
    @Query() query: GetEventsQueryDto,
  ) {
    return this.eventService.getGroupEvents(requesterId, groupId, query);
  }

  @Get(':id/interested')
  @UseGuards(JwtAuthGuard)
  async getEventInterestedUsers(
    @GetUser('id') requesterId: string,
    @Param('id', ParseUUIDPipe) eventId: string,
    @Query() query: GetEventsQueryDto,
  ) {
    return this.eventService.getEventInterestedUsers(
      requesterId,
      eventId,
      query,
    );
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  async getEventById(
    @GetUser('id') requesterId: string,
    @Param('id', ParseUUIDPipe) eventId: string,
  ) {
    return this.eventService.getEventById(requesterId, eventId);
  }

  @Post(':id/interest')
  @UseGuards(JwtAuthGuard)
  async showInterest(
    @GetUser() user: any,
    @Param('id', ParseUUIDPipe) eventId: string,
  ) {
    return this.eventService.showInterest(user, eventId);
  }

  @Delete(':id/interest')
  @UseGuards(JwtAuthGuard)
  async withdrawInterest(
    @GetUser('id') userId: string,
    @Param('id', ParseUUIDPipe) eventId: string,
  ) {
    return this.eventService.withdrawInterest(userId, eventId);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  async deleteEvent(
    @GetUser('id') userId: string,
    @Param('id', ParseUUIDPipe) eventId: string,
  ) {
    return this.eventService.deleteEvent(userId, eventId);
  }
}
