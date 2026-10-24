import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { readdirSync, statSync, unlinkSync } from 'fs';
import { join } from 'path';
import { TEMP_UPLOADS_DIR } from '@libs/common';

const STALE_THRESHOLD_MS = 30 * 60 * 1000;

@Injectable()
export class TempCleanupTask {
  private readonly logger = new Logger(TempCleanupTask.name);
  private isRunning = false;

  @Cron('0 */30 * * * *')
  async handleTempCleanup() {
    if (this.isRunning) {
      this.logger.warn('Temp cleanup is already running, skipping this cycle.');
      return;
    }

    this.isRunning = true;
    this.logger.log('Starting temp uploads cleanup...');

    try {
      let files: string[];
      try {
        files = readdirSync(TEMP_UPLOADS_DIR);
      } catch {
        this.logger.log('Temp directory does not exist, skipping cleanup.');
        return;
      }

      if (files.length === 0) {
        this.logger.log('No temp files to clean up.');
        return;
      }

      const now = Date.now();
      let deletedCount = 0;

      for (const file of files) {
        try {
          const filePath = join(TEMP_UPLOADS_DIR, file);
          const stat = statSync(filePath);

          if (now - stat.mtimeMs > STALE_THRESHOLD_MS) {
            unlinkSync(filePath);
            deletedCount++;
          }
        } catch (err) {
          this.logger.warn(`Failed to process temp file: ${file}`, err);
        }
      }

      this.logger.log(
        `Temp cleanup complete. Deleted ${deletedCount} stale file(s) out of ${files.length} total.`,
      );
    } catch (error) {
      this.logger.error('Failed to run temp cleanup', error);
    } finally {
      this.isRunning = false;
    }
  }
}
