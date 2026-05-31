import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PlatformBroadcastsService } from './platform-broadcasts.service';

@Injectable()
export class PlatformBroadcastSchedulerService {
  private readonly logger = new Logger(PlatformBroadcastSchedulerService.name);

  constructor(private readonly broadcasts: PlatformBroadcastsService) {}

  /** Poll DB for due scheduled broadcasts (no external queue in v1). */
  @Cron(CronExpression.EVERY_MINUTE)
  async tick(): Promise<void> {
    try {
      const processed = await this.broadcasts.processDueScheduled();
      if (processed > 0) {
        this.logger.log(`Processed ${processed} due platform broadcast(s)`);
      }
    } catch (err) {
      this.logger.error(
        `Scheduled broadcast tick failed: ${err instanceof Error ? err.message : err}`,
      );
    }
  }
}
