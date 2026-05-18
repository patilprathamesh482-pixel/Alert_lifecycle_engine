import { Injectable, OnModuleInit } from "@nestjs/common";

import { PersistenceService } from "../../../common/services/persistence.service";
import { Alert } from "../interfaces/alert.interface";

@Injectable()
export class AlertsRepository implements OnModuleInit {
  private readonly alerts = new Map<string, Alert>();

  private readonly storagePath = "alerts.json";

  constructor(private readonly persistenceService: PersistenceService) {}

  async onModuleInit(): Promise<void> {
    const alerts = await this.persistenceService.loadFromFile(
      this.storagePath,
      [] as Alert[],
    );

    for (const alert of alerts) {
      this.alerts.set(this.generateKey(alert.tenantId, alert.deviceId), alert);
    }
  }

  async save(alert: Alert): Promise<void> {
    this.alerts.set(this.generateKey(alert.tenantId, alert.deviceId), alert);

    await this.persist();
  }

  findByDevice(tenantId: string, deviceId: string): Alert | undefined {
    return this.alerts.get(this.generateKey(tenantId, deviceId));
  }

  findByAlertId(alertId: string): Alert | undefined {
    for (const alert of this.alerts.values()) {
      if (alert.alertId === alertId) {
        return alert;
      }
    }

    return undefined;
  }

  getAllAlerts(): Alert[] {
    return Array.from(this.alerts.values());
  }

  private generateKey(tenantId: string, deviceId: string): string {
    return `${tenantId}:${deviceId}`;
  }

  private async persist(): Promise<void> {
    await this.persistenceService.saveToFile(
      this.storagePath,
      this.getAllAlerts(),
    );
  }
}
