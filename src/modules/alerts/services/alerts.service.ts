import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { v4 as uuid } from "uuid";

import { ActivityAction } from "../enums/activity-action.enum";
import { AlertState } from "../enums/alert-state.enum";
import { EscalationState } from "../enums/escalation-state.enum";
import { EventType } from "../enums/event-type.enum";
import { ActivityLog } from "../interfaces/activity-log.interface";
import { Alert } from "../interfaces/alert.interface";
import { DeviceEvent } from "../interfaces/device-event.interface";
import { ActivityLogRepository } from "../repositories/activity-log.repository";
import { AlertsRepository } from "../repositories/alerts.repository";
import { ProcessedEventsRepository } from "../repositories/processed-events.repository";

@Injectable()
export class AlertsService {
  private readonly logger = new Logger(AlertsService.name);

  constructor(
    private readonly alertsRepository: AlertsRepository,
    private readonly activityLogRepository: ActivityLogRepository,
    private readonly processedEventsRepository: ProcessedEventsRepository,
  ) {}

  async processEvent(event: DeviceEvent): Promise<void> {
    if (
      this.processedEventsRepository.has(
        event.tenantId,
        event.deviceId,
        event.eventId,
      )
    ) {
      return;
    }

    const existingAlert = this.alertsRepository.findByDevice(
      event.tenantId,
      event.deviceId,
    );

    if (this.isOutOfOrder(event, existingAlert)) {
      this.logger.warn(`Ignored out-of-order event ${event.eventId}`);
      await this.markEventProcessed(event);
      return;
    }

    await this.addActivityLog({
      alertId: existingAlert?.alertId ?? "N/A",
      tenantId: event.tenantId,
      deviceId: event.deviceId,
      action: ActivityAction.EVENT_RECEIVED,
      timestamp: event.timestamp,
      metadata: { event },
    });

    if (event.eventType === EventType.DEVICE_DOWN) {
      await this.handleDeviceDown(event, existingAlert);
      await this.markEventProcessed(event);
      return;
    }

    await this.handleDeviceUp(event, existingAlert);
    await this.markEventProcessed(event);
  }

  getAlerts(): Alert[] {
    return this.alertsRepository.getAllAlerts();
  }

  getLogs(): ActivityLog[] {
    return this.activityLogRepository.getLogs();
  }

  async acknowledgeAlert(
    alertId: string,
    acknowledgedAt: number,
    acknowledgedBy?: string,
  ): Promise<Alert> {
    const alert = this.alertsRepository.findByAlertId(alertId);

    if (!alert) {
      throw new NotFoundException("Alert not found");
    }

    if (alert.state === AlertState.RESOLVED) {
      throw new BadRequestException("Resolved alerts cannot be acknowledged");
    }

    if (alert.state === AlertState.ACKNOWLEDGED) {
      return alert;
    }

    alert.state = AlertState.ACKNOWLEDGED;
    alert.updatedAt = acknowledgedAt;

    await this.alertsRepository.save(alert);

    await this.addActivityLog({
      alertId: alert.alertId,
      tenantId: alert.tenantId,
      deviceId: alert.deviceId,
      action: ActivityAction.ALERT_ACKNOWLEDGED,
      timestamp: acknowledgedAt,
      metadata: {
        tenantId: alert.tenantId,
        deviceId: alert.deviceId,
        acknowledgedAt,
        acknowledgedBy,
      },
    });

    return alert;
  }

  private async handleDeviceDown(
    event: DeviceEvent,
    existingAlert?: Alert,
  ): Promise<void> {
    if (!existingAlert) {
      const alert: Alert = {
        alertId: uuid(),
        tenantId: event.tenantId,
        deviceId: event.deviceId,
        state: AlertState.ACTIVE,
        escalationLevel: 1,
        escalationState: EscalationState.WARNING,
        createdAt: event.timestamp,
        updatedAt: event.timestamp,
        lastProcessedEventTimestamp: event.timestamp,
      };

      await this.alertsRepository.save(alert);

      await this.addActivityLog({
        alertId: alert.alertId,
        tenantId: alert.tenantId,
        deviceId: alert.deviceId,
        action: ActivityAction.ALERT_CREATED,
        timestamp: event.timestamp,
        metadata: { alert },
      });

      return;
    }

    existingAlert.lastProcessedEventTimestamp = event.timestamp;
    existingAlert.updatedAt = event.timestamp;

    if (existingAlert.state === AlertState.RESOLVED) {
      existingAlert.state = AlertState.ACTIVE;
      existingAlert.createdAt = event.timestamp;
      existingAlert.escalationLevel = 1;
      existingAlert.escalationState = EscalationState.WARNING;

      await this.addActivityLog({
        alertId: existingAlert.alertId,
        tenantId: existingAlert.tenantId,
        deviceId: existingAlert.deviceId,
        action: ActivityAction.ALERT_CREATED,
        timestamp: event.timestamp,
        metadata: {
          alert: existingAlert,
          reopened: true,
        },
      });
    }

    await this.alertsRepository.save(existingAlert);
  }

  private async handleDeviceUp(
    event: DeviceEvent,
    existingAlert?: Alert,
  ): Promise<void> {
    if (!existingAlert) {
      return;
    }

    if (existingAlert.state === AlertState.RESOLVED) {
      existingAlert.lastProcessedEventTimestamp = event.timestamp;
      existingAlert.updatedAt = event.timestamp;

      await this.alertsRepository.save(existingAlert);
      return;
    }

    existingAlert.state = AlertState.RESOLVED;
    existingAlert.updatedAt = event.timestamp;
    existingAlert.lastProcessedEventTimestamp = event.timestamp;

    await this.alertsRepository.save(existingAlert);

    await this.addActivityLog({
      alertId: existingAlert.alertId,
      tenantId: existingAlert.tenantId,
      deviceId: existingAlert.deviceId,
      action: ActivityAction.ALERT_RESOLVED,
      timestamp: event.timestamp,
      metadata: {
        tenantId: event.tenantId,
        deviceId: event.deviceId,
      },
    });
  }

  private isOutOfOrder(event: DeviceEvent, existingAlert?: Alert): boolean {
    return Boolean(
      existingAlert &&
      event.timestamp < existingAlert.lastProcessedEventTimestamp,
    );
  }

  private async addActivityLog(params: {
    alertId: string;
    tenantId?: string;
    deviceId?: string;
    action: ActivityAction;
    timestamp: number;
    metadata?: Record<string, unknown>;
  }): Promise<void> {
    await this.activityLogRepository.addLog({
      id: uuid(),
      alertId: params.alertId,
      tenantId: params.tenantId,
      deviceId: params.deviceId,
      action: params.action,
      timestamp: params.timestamp,
      metadata: params.metadata,
    });
  }

  private async markEventProcessed(event: DeviceEvent): Promise<void> {
    await this.processedEventsRepository.add(
      event.tenantId,
      event.deviceId,
      event.eventId,
    );
  }
}
