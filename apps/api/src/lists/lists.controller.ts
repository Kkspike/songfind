import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { ListsService } from './lists.service';
import { ImportService } from './import.service';
import { ExportService } from './export.service';
import { CreateListDto } from './dto/create-list.dto';
import { ImportTextDto } from './dto/import-text.dto';

@Controller('lists')
export class ListsController {
  constructor(
    private readonly lists: ListsService,
    private readonly importService: ImportService,
    private readonly exportService: ExportService,
  ) {}

  @Get()
  findAll() {
    return this.lists.findAll();
  }

  @Post()
  create(@Body() dto: CreateListDto) {
    return this.lists.create(dto.name);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.lists.findOne(id);
  }

  @Delete(':id')
  @HttpCode(204)
  remove(@Param('id') id: string) {
    return this.lists.remove(id);
  }

  @Delete(':id/items/:itemId')
  @HttpCode(204)
  removeItem(@Param('id') id: string, @Param('itemId') itemId: string) {
    return this.lists.removeItem(id, itemId);
  }

  @Post(':id/import/text')
  importText(@Param('id') id: string, @Body() dto: ImportTextDto) {
    return this.importService.importText(id, dto.text);
  }

  @Post(':id/import/csv')
  @UseInterceptors(FileInterceptor('file'))
  importCsv(@Param('id') id: string, @UploadedFile() file: Express.Multer.File) {
    return this.importService.importCsv(id, file.buffer);
  }

  @Get(':id/export')
  exportZip(@Param('id') id: string, @Res() res: Response) {
    return this.exportService.streamZip(id, res);
  }
}
