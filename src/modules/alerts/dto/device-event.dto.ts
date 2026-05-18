import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsString,
  Min,
} from "class-validator";
import { ApiProperty } from "@nestjs/swagger";
import { EventType } from "../enums/event-type.enum";

export class DeviceEventDto {
  @ApiProperty({
    example: "tenant-1",
  })
  @IsString()
  @IsNotEmpty()
  tenantId: string;

  @ApiProperty({
    example: "router-101",
  })
  @IsString()
  @IsNotEmpty()
  deviceId: string;

  @ApiProperty({
    enum: EventType,
  })
  @IsEnum(EventType)
  eventType: EventType;

  @ApiProperty({
    example: 1710000010,
  })
  @IsNumber()
  @IsInt()
  @Min(1)
  timestamp: number;

  @ApiProperty({
    example: "evt-001",
  })
  @IsString()
  @IsNotEmpty()
  eventId: string;
}
