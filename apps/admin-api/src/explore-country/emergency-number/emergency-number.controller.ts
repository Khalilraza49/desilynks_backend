import {
  Body,
  Controller,
  Delete,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { EmergencyNumberService } from './emergency-number.service';
import { JwtAuthGuard } from '../../auth/jwt.guard';
import { CreateEmergencyNumberDto } from './dto/create-emergency-number.dto';
import { UpdateEmergencyNumberDto } from './dto/update-emergency-number.dto';

@UseGuards(JwtAuthGuard)
@Controller('emergency-numbers')
export class EmergencyNumberController {
  constructor(
    private readonly emergencyNumberService: EmergencyNumberService,
  ) {}

  @Post(':countryId')
  async addEmergencyNumber(
    @Param('countryId', ParseUUIDPipe) countryId: string,
    @Body() dto: CreateEmergencyNumberDto,
  ) {
    return this.emergencyNumberService.addEmergencyNumber(countryId, dto);
  }

  @Patch(':id')
  async updateEmergencyNumber(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateEmergencyNumberDto,
  ) {
    return this.emergencyNumberService.updateEmergencyNumber(id, dto);
  }

  @Delete(':id')
  async deleteEmergencyNumber(@Param('id', ParseUUIDPipe) id: string) {
    return this.emergencyNumberService.deleteEmergencyNumber(id);
  }
}
