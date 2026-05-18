import { AlertState } from "../enums/alert-state.enum";
import { EscalationState } from "../enums/escalation-state.enum";

export interface Alert {
  alertId: string;

  tenantId: string;
  deviceId: string;

  state: AlertState;

  escalationLevel: number;
  escalationState: EscalationState;

  createdAt: number;
  updatedAt: number;

  lastProcessedEventTimestamp: number;
}
