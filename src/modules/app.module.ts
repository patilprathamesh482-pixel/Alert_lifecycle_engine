import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';

import { AlertsModule } from './alerts/alerts.module';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    AlertsModule,
  ],
})
export class AppModule {}