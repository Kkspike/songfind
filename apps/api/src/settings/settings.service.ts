import { Injectable } from '@nestjs/common';
import axios from 'axios';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateSettingsDto } from './dto/update-settings.dto';

export interface TestResult {
  ok: boolean;
  message: string;
}

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

  async testLidarr(): Promise<TestResult> {
    const s = await this.prisma.settings.findUnique({ where: { id: 1 } });
    if (!s?.lidarrUrl || !s.lidarrApiKey)
      return { ok: false, message: 'Lidarr URL or API key not configured' };
    try {
      const { data } = await axios.get(`${s.lidarrUrl.replace(/\/$/, '')}/api/v1/system/status`, {
        headers: { 'X-Api-Key': s.lidarrApiKey },
        timeout: 5000,
      });
      return { ok: true, message: `Connected — Lidarr v${data.version}` };
    } catch (e: any) {
      return { ok: false, message: e?.response?.data?.message ?? e.message };
    }
  }

  async testProwlarr(): Promise<TestResult> {
    const s = await this.prisma.settings.findUnique({ where: { id: 1 } });
    if (!s?.prowlarrUrl || !s.prowlarrApiKey)
      return { ok: false, message: 'Prowlarr URL or API key not configured' };
    try {
      const { data } = await axios.get(`${s.prowlarrUrl.replace(/\/$/, '')}/api/v1/system/status`, {
        headers: { 'X-Api-Key': s.prowlarrApiKey },
        timeout: 5000,
      });
      return { ok: true, message: `Connected — Prowlarr v${data.version}` };
    } catch (e: any) {
      return { ok: false, message: e?.response?.data?.message ?? e.message };
    }
  }

  async testAzuracast(): Promise<TestResult> {
    const s = await this.prisma.settings.findUnique({ where: { id: 1 } });
    if (!s?.azuracastUrl)
      return { ok: false, message: 'Azuracast URL not configured' };
    try {
      const { data } = await axios.get(`${s.azuracastUrl.replace(/\/$/, '')}/api/status`, {
        timeout: 5000,
      });
      return { ok: true, message: `Connected — Azuracast v${data.version ?? 'unknown'}` };
    } catch (e: any) {
      return { ok: false, message: e?.response?.data?.message ?? e.message };
    }
  }
}
