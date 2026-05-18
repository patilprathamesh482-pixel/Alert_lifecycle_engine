import { Injectable, OnModuleInit } from "@nestjs/common";

import { PersistenceService } from "../../../common/services/persistence.service";

@Injectable()
export class ProcessedEventsRepository implements OnModuleInit {
  private readonly eventKeys = new Set<string>();

  private readonly storagePath = "processed-events.json";

  constructor(private readonly persistenceService: PersistenceService) {}

  async onModuleInit(): Promise<void> {
    const eventKeys = await this.persistenceService.loadFromFile(
      this.storagePath,
      [] as string[],
    );

    for (const eventKey of eventKeys) {
      this.eventKeys.add(eventKey);
    }
  }

  has(tenantId: string, deviceId: string, eventId: string): boolean {
    return this.eventKeys.has(this.generateKey(tenantId, deviceId, eventId));
  }

  async add(
    tenantId: string,
    deviceId: string,
    eventId: string,
  ): Promise<void> {
    this.eventKeys.add(this.generateKey(tenantId, deviceId, eventId));
    await this.persist();
  }

  private async persist(): Promise<void> {
    await this.persistenceService.saveToFile(
      this.storagePath,
      Array.from(this.eventKeys).sort(),
    );
  }

  private generateKey(
    tenantId: string,
    deviceId: string,
    eventId: string,
  ): string {
    return `${tenantId}:${deviceId}:${eventId}`;
  }
}
