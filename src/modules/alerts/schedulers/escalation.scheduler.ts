import { Injectable } from '@nestjs/common';

import {
  Cron,
  CronExpression,
} from '@nestjs/schedule';

import { v4 as uuid } from 'uuid';

import { AlertsRepository } from '../repositories/alerts.repository';
import { ActivityLogRepository } from '../repositories/activity-log.repository';

import { AlertState } from '../enums/alert-state.enum';
import { EscalationState } from '../enums/escalation-state.enum';
import { ActivityAction } from '../enums/activity-action.enum';

@Injectable()
export class EscalationScheduler {
  constructor(
    private readonly alertsRepository: AlertsRepository,

    private readonly activityLogRepository: ActivityLogRepository,
  ) {}

  /**
   * Runs every 10 seconds
   */
  @Cron(CronExpression.EVERY_10_SECONDS)
  handleEscalation(): void {
    const alerts =
      this.alertsRepository.getAllAlerts();

    for (const alert of alerts) {
      /**
       * Ignore resolved alerts
       */
      if (
        alert.state ===
        AlertState.RESOLVED
      ) {
        continue;
      }

      const now = Date.now();

      /**
       * Elapsed seconds
       */
      const elapsedSeconds = Math.floor(
        (now - alert.createdAt) / 1000,
      );

      /**
       * Determine escalation
       */
      const escalation =
        this.determineEscalation(
          elapsedSeconds,
        );

      /**
       * Already at correct level
       */
      if (
        escalation.level ===
        alert.escalationLevel
      ) {
        continue;
      }

      /**
       * Apply escalation
       */
      alert.escalationLevel =
        escalation.level;

      alert.escalationState =
        escalation.state;

      alert.updatedAt = now;

      this.alertsRepository.save(alert);

      /**
       * Activity log
       */
      this.activityLogRepository.addLog({
        id: uuid(),

        alertId: alert.alertId,

        action:
          ActivityAction.ALERT_ESCALATED,

        timestamp: now,

        metadata: {
          escalationLevel:
            escalation.level,

          escalationState:
            escalation.state,
        },
      });
    }
  }

  /**
   * Determine escalation level
   */
  private determineEscalation(
    elapsedSeconds: number,
  ): {
    level: number;
    state: EscalationState;
  } {
    /**
     * 60+ seconds
     */
    if (elapsedSeconds >= 60) {
      return {
        level: 3,
        state:
          EscalationState.CRITICAL,
      };
    }

    /**
     * 30+ seconds
     */
    if (elapsedSeconds >= 30) {
      return {
        level: 2,
        state:
          EscalationState.ATTENTION,
      };
    }

    /**
     * Default
     */
    return {
      level: 1,
      state:
        EscalationState.WARNING,
    };
  }
}