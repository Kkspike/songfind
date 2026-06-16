import { Controller, Post } from '@nestjs/common';
import { NasScannerService } from './nas-scanner.service';

@Controller('nas-scanner')
export class NasScannerController {
  constructor(private readonly scanner: NasScannerService) {}

  @Post('scan')
  scan() {
    return this.scanner.scan();
  }
}
