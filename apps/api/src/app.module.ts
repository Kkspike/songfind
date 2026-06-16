import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'node:path';
import { PrismaModule } from './prisma/prisma.module';
import { ListsModule } from './lists/lists.module';
import { MatchingModule } from './matching/matching.module';
import { NasScannerModule } from './nas-scanner/nas-scanner.module';
import { AzuracastModule } from './azuracast/azuracast.module';
import { LidarrModule } from './lidarr/lidarr.module';
import { YoutubeFallbackModule } from './youtube-fallback/youtube-fallback.module';
import { AcquisitionModule } from './acquisition/acquisition.module';
import { SpotifyModule } from './spotify/spotify.module';
import { SettingsModule } from './settings/settings.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    ListsModule,
    MatchingModule,
    NasScannerModule,
    AzuracastModule,
    LidarrModule,
    YoutubeFallbackModule,
    AcquisitionModule,
    SpotifyModule,
    SettingsModule,
    ServeStaticModule.forRoot({
      rootPath: join(__dirname, '..', '..', '..', 'web', 'dist'),
      exclude: [
        '/lists{/*path}',
        '/settings{/*path}',
        '/spotify{/*path}',
        '/azuracast{/*path}',
        '/lidarr{/*path}',
        '/nas-scanner{/*path}',
        '/acquisition{/*path}',
      ],
    }),
  ],
})
export class AppModule {}
