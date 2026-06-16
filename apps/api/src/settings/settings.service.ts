import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateSettingsDto } from './dto/update-settings.dto';

@Injectable()
export class SettingsService {
  constructor(private readonly prisma: PrismaService) {}

  async get() {
    const settings = await this.prisma.settings.findUnique({ where: { id: 1 } });
    if (settings) {
      const { spotifyAccessToken, spotifyRefreshToken, ...rest } = settings;
      return { ...rest, spotifyConnected: !!spotifyAccessToken && !!spotifyRefreshToken };
    }
    return { id: 1, fallbackTimeoutMins: 30, spotifyConnected: false };
  }

  async update(dto: UpdateSettingsDto) {
    await this.prisma.settings.upsert({
      where: { id: 1 },
      create: { id: 1, ...dto },
      update: dto,
    });
    return this.get();
  }
}
