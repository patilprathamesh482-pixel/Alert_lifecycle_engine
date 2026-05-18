import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";

import { PersistenceService } from "./services/persistence.service";

@Module({
  imports: [ConfigModule],
  providers: [PersistenceService],
  exports: [PersistenceService],
})
export class CommonModule {}
