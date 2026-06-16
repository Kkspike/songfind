import { Controller, Param, Post } from '@nestjs/common';
import { LidarrAcquisitionService } from './lidarr-acquisition.service';

@Controller('lidarr')
export class LidarrController {
  constructor(private readonly acquisition: LidarrAcquisitionService) {}

  @Post('acquire/:trackId')
  acquire(@Param('trackId') trackId: string) {
    return this.acquisition.acquire(trackId);
  }

  @Post('check/:trackId')
  checkStatus(@Param('trackId') trackId: string) {
    return this.acquisition.checkStatus(trackId);
  }
}
