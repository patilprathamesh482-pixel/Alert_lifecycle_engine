import { Injectable } from '@nestjs/common';
import { ActivityLog } from '../interfaces/activity-log.interface';

@Injectable()
export class ActivityLogRepository {
  private readonly logs: ActivityLog[] = [];

  addLog(log: ActivityLog): void {
    this.logs.push(log);
  }

  getLogs(): ActivityLog[] {
    return this.logs;
  }
}