export default () => ({
  app: {
    port: Number(process.env.APP_PORT),
    corsOrigins: (process.env.CORS_ORIGINS ?? "")
      .split(",")
      .map((origin) => origin.trim())
      .filter(Boolean),
    bodyLimit: process.env.BODY_LIMIT ?? "100kb",
  },
  storage: {
    dataDir: process.env.DATA_DIR ?? "data",
  },
  alerts: {
    maxActivityLogs: Number(process.env.MAX_ACTIVITY_LOGS),
  },
  escalation: {
    intervalMs: Number(process.env.ESCALATION_INTERVAL_MS),
    attentionThresholdSeconds: Number(process.env.ATTENTION_THRESHOLD_SECONDS),
    criticalThresholdSeconds: Number(process.env.CRITICAL_THRESHOLD_SECONDS),
  },
  throttle: {
    ttl: Number(process.env.THROTTLE_TTL_MS),
    limit: Number(process.env.THROTTLE_LIMIT),
  },
  logging: {
    level: process.env.LOG_LEVEL ?? "info",
  },
});
