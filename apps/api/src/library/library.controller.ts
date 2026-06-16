import { Controller, Get, Query } from '@nestjs/common';
import { LibraryService } from './library.service';

@Controller('library')
export class LibraryController {
  constructor(private readonly library: LibraryService) {}

  @Get()
  search(@Query('q') q?: string) {
    return this.library.search(q);
  }
}
