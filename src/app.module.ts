import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { ScheduleModule } from "@nestjs/schedule";
import { ThrottlerModule } from "@nestjs/throttler";
import * as Joi from "joi";
import { LoggerModule } from "nestjs-pino";

import { HealthController } from "./common/controllers/health.controller";
import appConfig from "./config/app.config";
import { AlertsModule } from "./modules/alerts/alerts.module";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [appConfig],
      validationSchema: Joi.object({
        APP_PORT: Joi.number().port().default(3000).required(),
        CORS_ORIGINS: Joi.string().allow("").default(""),
        BODY_LIMIT: Joi.string().default("100kb"),
        DATA_DIR: Joi.string().default("data"),
        MAX_ACTIVITY_LOGS: Joi.number().integer().min(1).default(10000),
        ESCALATION_INTERVAL_MS: Joi.number().integer().min(1000).default(10000),
        ATTENTION_THRESHOLD_SECONDS: Joi.number().integer().min(1).default(30),
        CRITICAL_THRESHOLD_SECONDS: Joi.number()
          .integer()
          .min(1)
          .greater(Joi.ref("ATTENTION_THRESHOLD_SECONDS"))
          .default(60),
        THROTTLE_TTL_MS: Joi.number().integer().min(1000).default(60000),
        THROTTLE_LIMIT: Joi.number().integer().min(1).default(120),
        LOG_LEVEL: Joi.string()
          .valid("fatal", "error", "warn", "info", "debug", "trace", "silent")
          .default("info"),
      }),
    }),
    LoggerModule.forRoot({
      pinoHttp: {
        level: process.env.LOG_LEVEL ?? "info",
        redact: {
          paths: ["req.headers.authorization", "req.headers.cookie"],
          remove: true,
        },
      },
    }),
    ScheduleModule.forRoot(),
    ThrottlerModule.forRoot([
      {
        ttl: Number(process.env.THROTTLE_TTL_MS ?? 60000),
        limit: Number(process.env.THROTTLE_LIMIT ?? 120),
      },
    ]),
    AlertsModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
