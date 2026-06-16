import { Module } from '@nestjs/common';
import { SpotifyController } from './spotify.controller';
import { SpotifyService } from './spotify.service';
import { SpotifyImportService } from './spotify-import.service';
import { ListsModule } from '../lists/lists.module';

@Module({
  imports: [ListsModule],
  controllers: [SpotifyController],
  providers: [SpotifyService, SpotifyImportService],
})
export class SpotifyModule {}
