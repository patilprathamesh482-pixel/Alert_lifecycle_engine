import { Controller, Get } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";

@ApiTags("Health")
@Controller("health")
export class HealthController {
  @Get()
  @ApiOperation({
    summary: "Health check",
  })
  getHealth(): {
    status: "ok";
    timestamp: number;
  } {
    return {
      status: "ok",
      timestamp: Date.now(),
    };
  }
}
