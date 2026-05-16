import {
  IsEnum,
  IsNumber,
  IsString,
} from 'class-validator';

import { EventType } from '../enums/event-type.enum';

export class DeviceEventDto {
  @IsString()
  tenantId: string;

  @IsString()
  deviceId: string;

  @IsEnum(EventType)
  eventType: EventType;

  @IsNumber()
  timestamp: number;

  @IsString()
  eventId: string;
}