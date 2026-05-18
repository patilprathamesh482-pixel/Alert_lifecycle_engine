import { EventType } from "../enums/event-type.enum";

export interface DeviceEvent {
  tenantId: string;
  deviceId: string;
  eventType: EventType;
  timestamp: number;
  eventId: string;
}
