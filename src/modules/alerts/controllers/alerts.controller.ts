import {
  Body,
  Controller,
  Get,
  Post,
} from '@nestjs/common';

import { AlertsService } from '../services/alerts.service';

import { DeviceEventDto } from '../dto/device-event.dto';

@Controller('alerts')
export class AlertsController {
  constructor(
    private readonly alertsService: AlertsService,
  ) {}

  /**
   * Submit device event
   */
  @Post('events')
  processEvent(
    @Body() body: DeviceEventDto,
  ) {
    this.alertsService.processEvent(body);

    return {
      message:
        'Event processed successfully',
    };
  }

  /**
   * Get all alerts
   */
  @Get()
  getAlerts() {
    return this.alertsService.getAlerts();
  }

  /**
   * Get activity logs
   */
  @Get('logs')
  getLogs() {
    return this.alertsService.getLogs();
  }
}