import { ConfigModule } from "@nestjs/config";
import { Test, TestingModule } from "@nestjs/testing";
import { promises as fs } from "fs";
import * as os from "os";
import * as path from "path";

import { PersistenceService } from "../../../common/services/persistence.service";
import appConfig from "../../../config/app.config";
import { ActivityAction } from "../enums/activity-action.enum";
import { AlertState } from "../enums/alert-state.enum";
import { EscalationState } from "../enums/escalation-state.enum";
import { EventType } from "../enums/event-type.enum";
import { ActivityLogRepository } from "../repositories/activity-log.repository";
import { AlertsRepository } from "../repositories/alerts.repository";
import { ProcessedEventsRepository } from "../repositories/processed-events.repository";
import { EscalationScheduler } from "../schedulers/escalation.scheduler";
import { AlertsService } from "./alerts.service";
import { Alert } from "../interfaces/alert.interface";

async function createTestContext(): Promise<{
  dataDir: string;
  moduleRef: TestingModule;
  service: AlertsService;
  scheduler: EscalationScheduler;
}> {
  const dataDir = await fs.mkdtemp(path.join(os.tmpdir(), "alert-engine-"));

  process.env.DATA_DIR = dataDir;
  process.env.MAX_ACTIVITY_LOGS = "100";
  process.env.ESCALATION_INTERVAL_MS = "3600000";
  process.env.ATTENTION_THRESHOLD_SECONDS = "30";
  process.env.CRITICAL_THRESHOLD_SECONDS = "60";

  const moduleRef = await Test.createTestingModule({
    imports: [
      ConfigModule.forRoot({
        isGlobal: true,
        ignoreEnvFile: true,
        load: [appConfig],
      }),
    ],
    providers: [
      PersistenceService,
      AlertsRepository,
      ActivityLogRepository,
      ProcessedEventsRepository,
      AlertsService,
      EscalationScheduler,
    ],
  }).compile();

  await moduleRef.init();

  return {
    dataDir,
    moduleRef,
    service: moduleRef.get(AlertsService),
    scheduler: moduleRef.get(EscalationScheduler),
  };
}

function findAlert(alerts: Alert[], tenantId: string, deviceId: string): Alert {
  const alert = alerts.find(
    (candidate) =>
      candidate.tenantId === tenantId && candidate.deviceId === deviceId,
  );

  if (!alert) {
    throw new Error(`Alert not found for ${tenantId}:${deviceId}`);
  }

  return alert;
}

describe("AlertsService lifecycle", () => {
  afterEach(() => {
    delete process.env.DATA_DIR;
    delete process.env.MAX_ACTIVITY_LOGS;
    delete process.env.ESCALATION_INTERVAL_MS;
    delete process.env.ATTENTION_THRESHOLD_SECONDS;
    delete process.env.CRITICAL_THRESHOLD_SECONDS;
  });

  it("processes duplicate events idempotently", async () => {
    const context = await createTestContext();

    try {
      const event = {
        tenantId: "tenant-a",
        deviceId: "device-1",
        eventType: EventType.DEVICE_DOWN,
        timestamp: 1000,
        eventId: "event-1",
      };

      await context.service.processEvent(event);
      await context.service.processEvent(event);

      expect(context.service.getAlerts()).toHaveLength(1);
      expect(
        context.service
          .getLogs()
          .filter((log) => log.action === ActivityAction.ALERT_CREATED),
      ).toHaveLength(1);
    } finally {
      await context.moduleRef.close();
      await fs.rm(context.dataDir, {
        recursive: true,
        force: true,
      });
    }
  });

  it("ignores out-of-order events", async () => {
    const context = await createTestContext();

    try {
      await context.service.processEvent({
        tenantId: "tenant-a",
        deviceId: "device-1",
        eventType: EventType.DEVICE_DOWN,
        timestamp: 1000,
        eventId: "event-1",
      });
      await context.service.processEvent({
        tenantId: "tenant-a",
        deviceId: "device-1",
        eventType: EventType.DEVICE_UP,
        timestamp: 900,
        eventId: "event-2",
      });

      const [alert] = context.service.getAlerts();

      expect(alert.state).toBe(AlertState.ACTIVE);
      expect(alert.lastProcessedEventTimestamp).toBe(1000);
    } finally {
      await context.moduleRef.close();
      await fs.rm(context.dataDir, {
        recursive: true,
        force: true,
      });
    }
  });

  it("resolves alerts on DEVICE_UP", async () => {
    const context = await createTestContext();

    try {
      await context.service.processEvent({
        tenantId: "tenant-a",
        deviceId: "device-1",
        eventType: EventType.DEVICE_DOWN,
        timestamp: 1000,
        eventId: "event-1",
      });
      await context.service.processEvent({
        tenantId: "tenant-a",
        deviceId: "device-1",
        eventType: EventType.DEVICE_UP,
        timestamp: 2000,
        eventId: "event-2",
      });

      expect(context.service.getAlerts()[0].state).toBe(AlertState.RESOLVED);
    } finally {
      await context.moduleRef.close();
      await fs.rm(context.dataDir, {
        recursive: true,
        force: true,
      });
    }
  });

  it("acknowledges idempotently", async () => {
    const context = await createTestContext();

    try {
      await context.service.processEvent({
        tenantId: "tenant-a",
        deviceId: "device-1",
        eventType: EventType.DEVICE_DOWN,
        timestamp: 1000,
        eventId: "event-1",
      });

      const alert = context.service.getAlerts()[0];

      await context.service.acknowledgeAlert(alert.alertId, 2000, "operator");
      await context.service.acknowledgeAlert(alert.alertId, 3000, "operator");

      expect(alert.state).toBe(AlertState.ACKNOWLEDGED);
      expect(
        context.service
          .getLogs()
          .filter((log) => log.action === ActivityAction.ALERT_ACKNOWLEDGED),
      ).toHaveLength(1);
    } finally {
      await context.moduleRef.close();
      await fs.rm(context.dataDir, {
        recursive: true,
        force: true,
      });
    }
  });

  it("continues escalating acknowledged alerts", async () => {
    const context = await createTestContext();

    try {
      await context.service.processEvent({
        tenantId: "tenant-a",
        deviceId: "device-1",
        eventType: EventType.DEVICE_DOWN,
        timestamp: 100000,
        eventId: "event-1",
      });

      const alert = context.service.getAlerts()[0];

      await context.service.acknowledgeAlert(alert.alertId, 101000);
      await context.scheduler.handleEscalation(131000);

      expect(alert.state).toBe(AlertState.ACKNOWLEDGED);
      expect(alert.escalationState).toBe(EscalationState.ATTENTION);
    } finally {
      await context.moduleRef.close();
      await fs.rm(context.dataDir, {
        recursive: true,
        force: true,
      });
    }
  });

  it("isolates alerts by tenant and device", async () => {
    const context = await createTestContext();

    try {
      await context.service.processEvent({
        tenantId: "tenant-a",
        deviceId: "device-1",
        eventType: EventType.DEVICE_DOWN,
        timestamp: 1000,
        eventId: "event-1",
      });
      await context.service.processEvent({
        tenantId: "tenant-a",
        deviceId: "device-2",
        eventType: EventType.DEVICE_DOWN,
        timestamp: 1000,
        eventId: "event-2",
      });

      expect(context.service.getAlerts()).toHaveLength(2);
    } finally {
      await context.moduleRef.close();
      await fs.rm(context.dataDir, {
        recursive: true,
        force: true,
      });
    }
  });

  it("creates separate alerts for multiple devices under the same tenant", async () => {
    const context = await createTestContext();

    try {
      await context.service.processEvent({
        tenantId: "tenant-1",
        deviceId: "router-101",
        eventType: EventType.DEVICE_DOWN,
        timestamp: 1000,
        eventId: "event-1",
      });
      await context.service.processEvent({
        tenantId: "tenant-1",
        deviceId: "router-102",
        eventType: EventType.DEVICE_DOWN,
        timestamp: 1000,
        eventId: "event-2",
      });

      const alerts = context.service.getAlerts();

      expect(alerts).toHaveLength(2);
      expect(findAlert(alerts, "tenant-1", "router-101").state).toBe(
        AlertState.ACTIVE,
      );
      expect(findAlert(alerts, "tenant-1", "router-102").state).toBe(
        AlertState.ACTIVE,
      );
    } finally {
      await context.moduleRef.close();
      await fs.rm(context.dataDir, {
        recursive: true,
        force: true,
      });
    }
  });

  it("creates separate alerts for the same device id under different tenants", async () => {
    const context = await createTestContext();

    try {
      await context.service.processEvent({
        tenantId: "tenant-1",
        deviceId: "router-101",
        eventType: EventType.DEVICE_DOWN,
        timestamp: 1000,
        eventId: "event-1",
      });
      await context.service.processEvent({
        tenantId: "tenant-2",
        deviceId: "router-101",
        eventType: EventType.DEVICE_DOWN,
        timestamp: 1000,
        eventId: "event-2",
      });

      const alerts = context.service.getAlerts();

      expect(alerts).toHaveLength(2);
      expect(findAlert(alerts, "tenant-1", "router-101").state).toBe(
        AlertState.ACTIVE,
      );
      expect(findAlert(alerts, "tenant-2", "router-101").state).toBe(
        AlertState.ACTIVE,
      );
    } finally {
      await context.moduleRef.close();
      await fs.rm(context.dataDir, {
        recursive: true,
        force: true,
      });
    }
  });

  it("resolves only the matching tenant-device alert", async () => {
    const context = await createTestContext();

    try {
      await context.service.processEvent({
        tenantId: "tenant-1",
        deviceId: "router-101",
        eventType: EventType.DEVICE_DOWN,
        timestamp: 1000,
        eventId: "event-1",
      });
      await context.service.processEvent({
        tenantId: "tenant-1",
        deviceId: "router-102",
        eventType: EventType.DEVICE_DOWN,
        timestamp: 1000,
        eventId: "event-2",
      });
      await context.service.processEvent({
        tenantId: "tenant-1",
        deviceId: "router-101",
        eventType: EventType.DEVICE_UP,
        timestamp: 2000,
        eventId: "event-3",
      });

      const alerts = context.service.getAlerts();

      expect(findAlert(alerts, "tenant-1", "router-101").state).toBe(
        AlertState.RESOLVED,
      );
      expect(findAlert(alerts, "tenant-1", "router-102").state).toBe(
        AlertState.ACTIVE,
      );
    } finally {
      await context.moduleRef.close();
      await fs.rm(context.dataDir, {
        recursive: true,
        force: true,
      });
    }
  });

  it("acknowledges one tenant-device alert without changing another", async () => {
    const context = await createTestContext();

    try {
      await context.service.processEvent({
        tenantId: "tenant-1",
        deviceId: "router-101",
        eventType: EventType.DEVICE_DOWN,
        timestamp: 1000,
        eventId: "event-1",
      });
      await context.service.processEvent({
        tenantId: "tenant-1",
        deviceId: "router-102",
        eventType: EventType.DEVICE_DOWN,
        timestamp: 1000,
        eventId: "event-2",
      });

      const router101 = findAlert(
        context.service.getAlerts(),
        "tenant-1",
        "router-101",
      );

      await context.service.acknowledgeAlert(router101.alertId, 1500);

      const alerts = context.service.getAlerts();

      expect(findAlert(alerts, "tenant-1", "router-101").state).toBe(
        AlertState.ACKNOWLEDGED,
      );
      expect(findAlert(alerts, "tenant-1", "router-102").state).toBe(
        AlertState.ACTIVE,
      );
    } finally {
      await context.moduleRef.close();
      await fs.rm(context.dataDir, {
        recursive: true,
        force: true,
      });
    }
  });

  it("escalates tenant-device alerts independently", async () => {
    const context = await createTestContext();

    try {
      await context.service.processEvent({
        tenantId: "tenant-1",
        deviceId: "router-101",
        eventType: EventType.DEVICE_DOWN,
        timestamp: 100000,
        eventId: "event-1",
      });
      await context.service.processEvent({
        tenantId: "tenant-1",
        deviceId: "router-102",
        eventType: EventType.DEVICE_DOWN,
        timestamp: 120000,
        eventId: "event-2",
      });

      await context.scheduler.handleEscalation(131000);

      const alerts = context.service.getAlerts();

      expect(findAlert(alerts, "tenant-1", "router-101").escalationState).toBe(
        EscalationState.ATTENTION,
      );
      expect(findAlert(alerts, "tenant-1", "router-102").escalationState).toBe(
        EscalationState.WARNING,
      );
    } finally {
      await context.moduleRef.close();
      await fs.rm(context.dataDir, {
        recursive: true,
        force: true,
      });
    }
  });

  it("scopes duplicate event detection by tenant-device pair", async () => {
    const context = await createTestContext();

    try {
      await context.service.processEvent({
        tenantId: "tenant-1",
        deviceId: "router-101",
        eventType: EventType.DEVICE_DOWN,
        timestamp: 1000,
        eventId: "shared-event-id",
      });
      await context.service.processEvent({
        tenantId: "tenant-1",
        deviceId: "router-102",
        eventType: EventType.DEVICE_DOWN,
        timestamp: 1000,
        eventId: "shared-event-id",
      });
      await context.service.processEvent({
        tenantId: "tenant-2",
        deviceId: "router-101",
        eventType: EventType.DEVICE_DOWN,
        timestamp: 1000,
        eventId: "shared-event-id",
      });

      expect(context.service.getAlerts()).toHaveLength(3);
    } finally {
      await context.moduleRef.close();
      await fs.rm(context.dataDir, {
        recursive: true,
        force: true,
      });
    }
  });

  it("recovers independent tenant-device alerts and processed event keys after restart", async () => {
    const firstContext = await createTestContext();
    const dataDir = firstContext.dataDir;

    await firstContext.service.processEvent({
      tenantId: "tenant-1",
      deviceId: "router-101",
      eventType: EventType.DEVICE_DOWN,
      timestamp: 1000,
      eventId: "event-1",
    });
    await firstContext.service.processEvent({
      tenantId: "tenant-1",
      deviceId: "router-102",
      eventType: EventType.DEVICE_DOWN,
      timestamp: 1000,
      eventId: "event-2",
    });
    await firstContext.service.processEvent({
      tenantId: "tenant-2",
      deviceId: "router-101",
      eventType: EventType.DEVICE_DOWN,
      timestamp: 1000,
      eventId: "event-3",
    });
    await firstContext.moduleRef.close();

    process.env.DATA_DIR = dataDir;

    const secondModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          ignoreEnvFile: true,
          load: [appConfig],
        }),
      ],
      providers: [
        PersistenceService,
        AlertsRepository,
        ActivityLogRepository,
        ProcessedEventsRepository,
        AlertsService,
      ],
    }).compile();

    await secondModule.init();

    try {
      const service = secondModule.get(AlertsService);

      await service.processEvent({
        tenantId: "tenant-1",
        deviceId: "router-101",
        eventType: EventType.DEVICE_DOWN,
        timestamp: 1000,
        eventId: "event-1",
      });
      await service.processEvent({
        tenantId: "tenant-1",
        deviceId: "router-101",
        eventType: EventType.DEVICE_UP,
        timestamp: 2000,
        eventId: "event-4",
      });

      const alerts = service.getAlerts();

      expect(alerts).toHaveLength(3);
      expect(findAlert(alerts, "tenant-1", "router-101").state).toBe(
        AlertState.RESOLVED,
      );
      expect(findAlert(alerts, "tenant-1", "router-102").state).toBe(
        AlertState.ACTIVE,
      );
      expect(findAlert(alerts, "tenant-2", "router-101").state).toBe(
        AlertState.ACTIVE,
      );
      expect(service.getLogs()).toHaveLength(8);

      const processedEventsPath = path.join(dataDir, "processed-events.json");
      const processedEvents = JSON.parse(
        await fs.readFile(processedEventsPath, "utf-8"),
      ) as string[];

      expect(processedEvents).toEqual(
        expect.arrayContaining([
          "tenant-1:router-101:event-1",
          "tenant-1:router-102:event-2",
          "tenant-2:router-101:event-3",
          "tenant-1:router-101:event-4",
        ]),
      );
    } finally {
      await secondModule.close();
      await fs.rm(dataDir, {
        recursive: true,
        force: true,
      });
    }
  });
});
