import { Module } from '@nestjs/common';

import { AlertsController } from './controllers/alerts.controller';

import { AlertsService } from './services/alerts.service';

import { EscalationScheduler } from './schedulers/escalation.scheduler';

import { AlertsRepository } from './repositories/alerts.repository';

import { ActivityLogRepository } from './repositories/activity-log.repository';

@Module({
  controllers: [AlertsController],

  providers: [
    AlertsService,
    EscalationScheduler,
    AlertsRepository,
    ActivityLogRepository,
  ],

  exports: [AlertsService],
})
export class AlertsModule {}