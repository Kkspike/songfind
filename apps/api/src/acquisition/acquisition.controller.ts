import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { AcquisitionService } from './acquisition.service';

@Controller('acquisition')
export class AcquisitionController {
  constructor(private readonly acquisition: AcquisitionService) {}

  @Post('recheck')
  recheckAcquiring() {
    return this.acquisition.recheckAcquiring();
  }

  @Post('check-timeouts')
  checkTimeouts() {
    return this.acquisition.checkTimeouts();
  }

  @Get('jobs')
  listJobs() {
    return this.acquisition.listJobs();
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
