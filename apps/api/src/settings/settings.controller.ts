import { Body, Controller, Get, Post, Put } from '@nestjs/common';
import { SettingsService } from './settings.service';
import { UpdateSettingsDto } from './dto/update-settings.dto';

@Controller('settings')
export class SettingsController {
  constructor(private readonly settings: SettingsService) {}

  @Get()
  get() {
    return this.settings.get();
  }

  @Put()
  update(@Body() dto: UpdateSettingsDto) {
    return this.settings.update(dto);
  }

  @Post('test/lidarr')
  testLidarr() {
    return this.settings.testLidarr();
  }

  @Post('test/prowlarr')
  testProwlarr() {
    return this.settings.testProwlarr();
  }

  @Post('test/azuracast')
  testAzuracast() {
    return this.settings.testAzuracast();
  }

  @Post('merge-duplicates')
  mergeDuplicates() {
    return this.settings.findAndMergeDuplicates();
  }
}
