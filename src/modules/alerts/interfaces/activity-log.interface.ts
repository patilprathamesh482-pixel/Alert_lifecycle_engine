import { ActivityAction } from '../enums/activity-action.enum';

export interface ActivityLog {
  id: string;

  alertId: string;

  action: ActivityAction;

  timestamp: number;

  metadata?: Record<string, unknown>;
}