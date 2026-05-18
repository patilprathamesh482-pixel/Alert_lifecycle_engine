import { Injectable, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

import { PersistenceService } from "../../../common/services/persistence.service";
import { ActivityLog } from "../interfaces/activity-log.interface";

@Injectable()
export class ActivityLogRepository implements OnModuleInit {
  private readonly logs: ActivityLog[] = [];

  private readonly storagePath = "activity-logs.json";

  constructor(
    private readonly persistenceService: PersistenceService,
    private readonly configService: ConfigService,
  ) {}

  async onModuleInit(): Promise<void> {
    const logs = await this.persistenceService.loadFromFile(
      this.storagePath,
      [] as ActivityLog[],
    );

    this.logs.push(...logs);
    this.truncate();
  }

  async addLog(log: ActivityLog): Promise<void> {
    this.logs.push(log);
    this.truncate();
    await this.persist();
  }

  getLogs(): ActivityLog[] {
    return [...this.logs];
  }

  private truncate(): void {
    const maxLogs = this.configService.get<number>(
      "alerts.maxActivityLogs",
      10000,
    );

    if (this.logs.length <= maxLogs) {
      return;
    }

    this.logs.splice(0, this.logs.length - maxLogs);
  }

  private async persist(): Promise<void> {
    await this.persistenceService.saveToFile(this.storagePath, this.logs);
  }
}
