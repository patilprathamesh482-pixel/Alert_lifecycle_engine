import { Injectable } from '@nestjs/common';

import { v4 as uuid } from 'uuid';

import { AlertsRepository } from '../repositories/alerts.repository';
import { ActivityLogRepository } from '../repositories/activity-log.repository';

import { DeviceEvent } from '../interfaces/device-event.interface';
import { Alert } from '../interfaces/alert.interface';

import { EventType } from '../enums/event-type.enum';
import { AlertState } from '../enums/alert-state.enum';
import { EscalationState } from '../enums/escalation-state.enum';
import { ActivityAction } from '../enums/activity-action.enum';

@Injectable()
export class AlertsService {
  constructor(
    private readonly alertsRepository: AlertsRepository,

    private readonly activityLogRepository: ActivityLogRepository,
  ) {}

  /**
   * Used for event deduplication
   */
  private readonly processedEventIds =
    new Set<string>();

  processEvent(event: DeviceEvent): void {
    /**
     * STEP 1
     * Deduplicate events
     */
    if (
      this.processedEventIds.has(
        event.eventId,
      )
    ) {
      return;
    }

    this.processedEventIds.add(
      event.eventId,
    );

    /**
     * STEP 2
     * Log incoming event
     */
    this.addActivityLog({
      alertId: 'N/A',
      action: ActivityAction.EVENT_RECEIVED,
      metadata: {
        event,
      },
    });

    /**
     * STEP 3
     * Get existing alert
     */
    const existingAlert =
      this.alertsRepository.findByDevice(
        event.tenantId,
        event.deviceId,
      );

    /**
     * STEP 4
     * Handle DEVICE_DOWN
     */
    if (
      event.eventType ===
      EventType.DEVICE_DOWN
    ) {
      this.handleDeviceDown(
        event,
        existingAlert,
      );

      return;
    }

    /**
     * STEP 5
     * Handle DEVICE_UP
     */
    if (
      event.eventType ===
      EventType.DEVICE_UP
    ) {
      this.handleDeviceUp(
        event,
        existingAlert,
      );
    }
  }

  /**
   * Handle DEVICE_DOWN event
   */
  private handleDeviceDown(
    event: DeviceEvent,
    existingAlert?: Alert,
  ): void {
    /**
     * CASE 1
     * No existing alert
     * Create new alert
     */
    if (!existingAlert) {
      const alert: Alert = {
        alertId: uuid(),

        tenantId: event.tenantId,
        deviceId: event.deviceId,

        state: AlertState.ACTIVE,

        escalationLevel: 1,

        escalationState:
          EscalationState.WARNING,

        createdAt: event.timestamp,

        updatedAt: event.timestamp,

        lastProcessedEventTimestamp:
          event.timestamp,
      };

      this.alertsRepository.save(alert);

      this.addActivityLog({
        alertId: alert.alertId,
        action: ActivityAction.ALERT_CREATED,
        metadata: {
          alert,
        },
      });

      return;
    }

    /**
     * CASE 2
     * Ignore older events
     * (out-of-order protection)
     */
    if (
      event.timestamp <
      existingAlert.lastProcessedEventTimestamp
    ) {
      return;
    }

    /**
     * CASE 3
     * Alert already active
     * Ignore duplicate DOWN
     */
    if (
      existingAlert.state !==
      AlertState.RESOLVED
    ) {
      existingAlert.lastProcessedEventTimestamp =
        event.timestamp;

      existingAlert.updatedAt =
        event.timestamp;

      this.alertsRepository.save(
        existingAlert,
      );

      return;
    }

    /**
     * CASE 4
     * Re-open resolved alert
     */
    existingAlert.state =
      AlertState.ACTIVE;

    existingAlert.updatedAt =
      event.timestamp;

    existingAlert.lastProcessedEventTimestamp =
      event.timestamp;

    existingAlert.escalationLevel = 1;

    existingAlert.escalationState =
      EscalationState.WARNING;

    this.alertsRepository.save(
      existingAlert,
    );
  }

  /**
   * Handle DEVICE_UP event
   */
  private handleDeviceUp(
    event: DeviceEvent,
    existingAlert?: Alert,
  ): void {
    /**
     * No alert exists
     */
    if (!existingAlert) {
      return;
    }

    /**
     * Ignore older events
     */
    if (
      event.timestamp <
      existingAlert.lastProcessedEventTimestamp
    ) {
      return;
    }

    /**
     * Already resolved
     */
    if (
      existingAlert.state ===
      AlertState.RESOLVED
    ) {
      return;
    }

    /**
     * Resolve alert
     */
    existingAlert.state =
      AlertState.RESOLVED;

    existingAlert.updatedAt =
      event.timestamp;

    existingAlert.lastProcessedEventTimestamp =
      event.timestamp;

    this.alertsRepository.save(
      existingAlert,
    );

    this.addActivityLog({
      alertId: existingAlert.alertId,
      action: ActivityAction.ALERT_RESOLVED,
      metadata: {
        deviceId: event.deviceId,
      },
    });
  }

  /**
   * Create activity log
   */
  private addActivityLog(params: {
    alertId: string;
    action: ActivityAction;
    metadata?: Record<string, unknown>;
  }): void {
    this.activityLogRepository.addLog({
      id: uuid(),

      alertId: params.alertId,

      action: params.action,

      timestamp: Date.now(),

      metadata: params.metadata,
    });
  }

  /**
   * Fetch all alerts
   */
  getAlerts(): Alert[] {
    return this.alertsRepository.getAllAlerts();
  }

  /**
   * Fetch logs
   */
  getLogs() {
    return this.activityLogRepository.getLogs();
  }
}