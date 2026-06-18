import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { SchedulerRegistry } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { NasScannerService } from '../nas-scanner/nas-scanner.service';
import { AzuracastService } from '../azuracast/azuracast.service';
import { AcquisitionService } from '../acquisition/acquisition.service';

@Injectable()
export class SchedulerService implements OnModuleInit {
  private readonly logger = new Logger(SchedulerService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly schedulerRegistry: SchedulerRegistry,
    private readonly nasScanner: NasScannerService,
    private readonly azuracast: AzuracastService,
    private readonly acquisition: AcquisitionService,
  ) {}

  async onModuleInit() {
    await this.applySchedules();
  }

  async applySchedules() {
    const settings = await this.prisma.settings.findUnique({ where: { id: 1 } });
    this.setOrClearInterval('nas-scan', settings?.scanIntervalMins ?? 0, () => this.nasScanner.scan());
    this.setOrClearInterval('azuracast-poll', settings?.azuracastPollIntervalMins ?? 0, () => this.azuracast.poll());
    this.setOrClearInterval('acquiring-recheck', settings?.recheckIntervalMins ?? 0, () => this.acquisition.recheckAcquiring());
  }

  private setOrClearInterval(name: string, intervalMins: number, fn: () => Promise<unknown>) {
    try {
      this.schedulerRegistry.deleteInterval(name);
    } catch {}

    if (intervalMins <= 0) return;

    const ms = intervalMins * 60_000;
    const handle = setInterval(() => {
      fn().catch((err) => this.logger.error(`Scheduled ${name} failed`, err));
    }, ms);
    this.schedulerRegistry.addInterval(name, handle);
    this.logger.log(`Scheduled ${name} every ${intervalMins} min`);
  }
}
