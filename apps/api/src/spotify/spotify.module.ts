import { Module } from '@nestjs/common';
import { SpotifyController } from './spotify.controller';
import { SpotifyService } from './spotify.service';
import { SpotifyImportService } from './spotify-import.service';
import { ListsModule } from '../lists/lists.module';
import { MatchingModule } from '../matching/matching.module';
import { AzuracastModule } from '../azuracast/azuracast.module';

@Module({
  imports: [ListsModule, MatchingModule, AzuracastModule],
  controllers: [SpotifyController],
  providers: [SpotifyService, SpotifyImportService],
})
export class SpotifyModule {}
