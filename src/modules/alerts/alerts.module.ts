import { Module } from "@nestjs/common";

import { CommonModule } from "../../common/common.module";

import { AlertsController } from "./controllers/alerts.controller";

import { AlertsService } from "./services/alerts.service";

import { EscalationScheduler } from "./schedulers/escalation.scheduler";

import { AlertsRepository } from "./repositories/alerts.repository";

import { ActivityLogRepository } from "./repositories/activity-log.repository";
import { ProcessedEventsRepository } from "./repositories/processed-events.repository";

@Module({
  imports: [CommonModule],

  controllers: [AlertsController],

  providers: [
    AlertsService,
    EscalationScheduler,
    AlertsRepository,
    ActivityLogRepository,
    ProcessedEventsRepository,
  ],

  exports: [AlertsService],
})
export class AlertsModule {}
