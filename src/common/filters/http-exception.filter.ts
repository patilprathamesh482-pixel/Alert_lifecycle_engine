import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from "@nestjs/common";

import { Request, Response } from "express";

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();

    const response = ctx.getResponse<Response>();

    const request = ctx.getRequest<Request>();

    /**
     * Default values
     */
    let status = HttpStatus.INTERNAL_SERVER_ERROR;

    let message = "Internal server error";

    /**
     * Handle NestJS HTTP exceptions
     */
    if (exception instanceof HttpException) {
      status = exception.getStatus();

      const exceptionResponse = exception.getResponse();

      /**
       * Validation errors
       */
      if (typeof exceptionResponse === "object") {
        const responseObject = exceptionResponse as Record<string, unknown>;

        message = Array.isArray(responseObject.message)
          ? responseObject.message.join(", ")
          : String(responseObject.message);
      } else {
        message = String(exceptionResponse);
      }
    } else if (exception instanceof Error) {
      message = exception.message;
      this.logger.error(message, exception.stack);
    }

    /**
     * Standardized response
     */
    response.status(status).json({
      statusCode: status,

      timestamp: new Date().toISOString(),

      path: request.url,

      method: request.method,

      message,
    });
  }
}
