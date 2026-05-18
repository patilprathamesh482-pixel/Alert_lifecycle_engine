import { Logger, ValidationPipe } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { NestFactory } from "@nestjs/core";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import compression from "compression";
import { json, NextFunction, Request, Response, urlencoded } from "express";
import helmet from "helmet";
import { Logger as PinoLogger } from "nestjs-pino";

import { AppModule } from "./app.module";
import { HttpExceptionFilter } from "./common/filters/http-exception.filter";

async function bootstrap(): Promise<void> {
  const logger = new Logger("Bootstrap");
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
    bodyParser: false,
  });
  const configService = app.get(ConfigService);
  app.useLogger(app.get(PinoLogger));

  const bodyLimit = configService.get<string>("app.bodyLimit", "100kb");
  const corsOrigins = configService.get<string[]>("app.corsOrigins", []);

  app.use(helmet());
  app.use(compression());
  app.use(
    json({
      limit: bodyLimit,
      strict: true,
    }),
  );
  app.use(
    urlencoded({
      extended: false,
      limit: bodyLimit,
    }),
  );
  app.enableCors({
    origin: corsOrigins.length > 0 ? corsOrigins : false,
  });
  app.use((request: Request, response: Response, next: NextFunction) => {
    const startedAt = Date.now();

    response.on("finish", () => {
      logger.debug({
        method: request.method,
        path: request.originalUrl,
        statusCode: response.statusCode,
        durationMs: Date.now() - startedAt,
      });
    });

    next();
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: false,
      },
    }),
  );

  app.useGlobalFilters(new HttpExceptionFilter());

  const swaggerConfig = new DocumentBuilder()
    .setTitle("Alert Lifecycle Engine")
    .setDescription("Deterministic alert lifecycle management service")
    .setVersion("1.0")
    .build();

  SwaggerModule.setup(
    "api-docs",
    app,
    SwaggerModule.createDocument(app, swaggerConfig),
  );

  const port = configService.get<number>("app.port", 3000);

  await app.listen(port);

  logger.log(`Application running on port ${port}`);
}

bootstrap();
