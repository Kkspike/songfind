import { Controller, Post } from '@nestjs/common';
import { AzuracastService } from './azuracast.service';

@Controller('azuracast')
export class AzuracastController {
  constructor(private readonly azuracast: AzuracastService) {}

  @Post('poll')
  poll() {
    return this.azuracast.poll();
  }
}
