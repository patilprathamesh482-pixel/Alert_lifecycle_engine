import { Body, Controller, Get, Param, Post } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";

import { AlertsService } from "../services/alerts.service";

import { DeviceEventDto } from "../dto/device-event.dto";

import { AcknowledgeAlertDto } from "../dto/acknowledge-alert.dto";

import { ApiBody, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
@ApiTags("Alerts")
@Controller("alerts")
export class AlertsController {
  constructor(private readonly alertsService: AlertsService) {}

  /**
   * Submit device event
   */
  @ApiOperation({
    summary: "Process incoming device event",
  })
  @ApiResponse({
    status: 201,
    description: "Event processed successfully",
  })
  @ApiBody({
    type: DeviceEventDto,
  })
  @Post("events")
  @Throttle({ default: { limit: 60, ttl: 60000 } })
  async processEvent(
    @Body() body: DeviceEventDto,
  ): Promise<{ message: string }> {
    await this.alertsService.processEvent(body);

    return {
      message: "Event processed successfully",
    };
  }

  /**
   * Get all alerts
   */
  @ApiOperation({
    summary: "Get all alerts",
  })
  @Get()
  getAlerts() {
    return this.alertsService.getAlerts();
  }

  /**
   * Get activity logs
   */
  @ApiOperation({
    summary: "Get activity logs",
  })
  @Get("logs")
  getLogs() {
    return this.alertsService.getLogs();
  }

  @ApiOperation({
    summary: "Acknowledge alert",
  })
  @ApiBody({
    type: AcknowledgeAlertDto,
  })
  @Post(":alertId/acknowledge")
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  async acknowledgeAlert(
    @Param("alertId")
    alertId: string,

    @Body()
    body: AcknowledgeAlertDto,
  ) {
    return await this.alertsService.acknowledgeAlert(
      alertId,
      body.acknowledgedAt,
      body.acknowledgedBy,
    );
  }
}
