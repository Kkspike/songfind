import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { AcquisitionService } from './acquisition.service';

@Controller('acquisition')
export class AcquisitionController {
  constructor(private readonly acquisition: AcquisitionService) {}

  @Post('check-timeouts')
  checkTimeouts() {
    return this.acquisition.checkTimeouts();
  }

  @Get('pending')
  listPending() {
    return this.acquisition.listPendingApprovals();
  }

  @Post(':jobId/approve')
  approve(@Param('jobId') jobId: string, @Body('videoId') videoId: string) {
    return this.acquisition.approveCandidate(jobId, videoId);
  }
}
