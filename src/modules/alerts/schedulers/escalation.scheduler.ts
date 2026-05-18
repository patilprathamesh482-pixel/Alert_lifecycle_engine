import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { v4 as uuid } from "uuid";

import { ActivityAction } from "../enums/activity-action.enum";
import { AlertState } from "../enums/alert-state.enum";
import { EscalationState } from "../enums/escalation-state.enum";
import { ActivityLogRepository } from "../repositories/activity-log.repository";
import { AlertsRepository } from "../repositories/alerts.repository";

@Injectable()
export class EscalationScheduler implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(EscalationScheduler.name);

  private interval?: NodeJS.Timeout;

  constructor(
    private readonly alertsRepository: AlertsRepository,
    private readonly activityLogRepository: ActivityLogRepository,
    private readonly configService: ConfigService,
  ) {}

  onModuleInit(): void {
    const intervalMs = this.configService.get<number>(
      "escalation.intervalMs",
      10000,
    );

    this.interval = setInterval(() => {
      this.handleEscalation().catch((error: unknown) => {
        this.logger.error(
          "Escalation scheduler failed",
          error instanceof Error ? error.stack : String(error),
        );
      });
    }, intervalMs);
  }

  onModuleDestroy(): void {
    if (this.interval) {
      clearInterval(this.interval);
    }
  }

  async handleEscalation(now = Date.now()): Promise<void> {
    const alerts = this.alertsRepository.getAllAlerts();

    for (const alert of alerts) {
      if (alert.state === AlertState.RESOLVED) {
        continue;
      }

      const elapsedSeconds = Math.floor((now - alert.createdAt) / 1000);

      const escalation = this.determineEscalation(elapsedSeconds);

      if (escalation.level === alert.escalationLevel) {
        continue;
      }

      alert.escalationLevel = escalation.level;
      alert.escalationState = escalation.state;
      alert.updatedAt = now;

      await this.alertsRepository.save(alert);

      await this.activityLogRepository.addLog({
        id: uuid(),
        alertId: alert.alertId,
        tenantId: alert.tenantId,
        deviceId: alert.deviceId,
        action: ActivityAction.ALERT_ESCALATED,
        timestamp: now,
        metadata: {
          tenantId: alert.tenantId,
          deviceId: alert.deviceId,
          escalationLevel: escalation.level,
          escalationState: escalation.state,
        },
      });
    }
  }

  private determineEscalation(elapsedSeconds: number): {
    level: number;
    state: EscalationState;
  } {
    const attentionThreshold = this.configService.get<number>(
      "escalation.attentionThresholdSeconds",
      30,
    );

    const criticalThreshold = this.configService.get<number>(
      "escalation.criticalThresholdSeconds",
      60,
    );

    if (elapsedSeconds >= criticalThreshold) {
      return {
        level: 3,
        state: EscalationState.CRITICAL,
      };
    }

    if (elapsedSeconds >= attentionThreshold) {
      return {
        level: 2,
        state: EscalationState.ATTENTION,
      };
    }

    return {
      level: 1,
      state: EscalationState.WARNING,
    };
  }
}
