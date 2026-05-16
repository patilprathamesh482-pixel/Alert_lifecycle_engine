import { Injectable } from '@nestjs/common';
import { Alert } from '../interfaces/alert.interface';

@Injectable()
export class AlertsRepository {
  private readonly alerts = new Map<string, Alert>();

  generateKey(tenantId: string, deviceId: string): string {
    return `${tenantId}:${deviceId}`;
  }

  save(alert: Alert): void {
    const key = this.generateKey(
      alert.tenantId,
      alert.deviceId,
    );

    this.alerts.set(key, alert);
  }

  findByDevice(
    tenantId: string,
    deviceId: string,
  ): Alert | undefined {
    const key = this.generateKey(
      tenantId,
      deviceId,
    );

    return this.alerts.get(key);
  }

  getAllAlerts(): Alert[] {
    return Array.from(this.alerts.values());
  }
}