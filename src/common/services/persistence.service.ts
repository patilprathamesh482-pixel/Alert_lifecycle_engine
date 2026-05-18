import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

import { promises as fs } from "fs";
import * as path from "path";

@Injectable()
export class PersistenceService {
  private readonly logger = new Logger(PersistenceService.name);

  private readonly writes = new Map<string, Promise<void>>();

  constructor(private readonly configService: ConfigService) {}

  async saveToFile<T>(filePath: string, data: T): Promise<void> {
    const resolvedPath = this.resolveStoragePath(filePath);
    const previousWrite = this.writes.get(resolvedPath) ?? Promise.resolve();

    const nextWrite = previousWrite
      .catch(() => undefined)
      .then(() => this.atomicWrite(resolvedPath, data));

    this.writes.set(resolvedPath, nextWrite);

    await nextWrite;
  }

  async loadFromFile<T>(filePath: string, fallback: T): Promise<T> {
    const resolvedPath = this.resolveStoragePath(filePath);

    try {
      const content = await fs.readFile(resolvedPath, "utf-8");

      return JSON.parse(content) as T;
    } catch (error) {
      const nodeError = error as NodeJS.ErrnoException;

      if (nodeError.code === "ENOENT") {
        return fallback;
      }

      this.logger.error(
        `Failed to load file: ${resolvedPath}`,
        error instanceof Error ? error.stack : String(error),
      );

      return fallback;
    }
  }

  private async atomicWrite<T>(resolvedPath: string, data: T): Promise<void> {
    const directory = path.dirname(resolvedPath);

    await fs.mkdir(directory, {
      recursive: true,
    });

    const tempPath = `${resolvedPath}.${process.pid}.${Date.now()}.tmp`;
    const payload = `${JSON.stringify(data, null, 2)}\n`;

    try {
      await fs.writeFile(tempPath, payload, "utf-8");
      await fs.rename(tempPath, resolvedPath);
    } catch (error) {
      await fs.rm(tempPath, {
        force: true,
      });

      this.logger.error(
        `Failed to save file: ${resolvedPath}`,
        error instanceof Error ? error.stack : String(error),
      );

      throw error;
    }
  }

  private resolveStoragePath(filePath: string): string {
    const storageRoot = path.resolve(
      this.configService.get<string>("storage.dataDir", "data"),
    );
    const resolvedPath = path.resolve(storageRoot, filePath);
    const relativePath = path.relative(storageRoot, resolvedPath);

    if (relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
      throw new Error(`Persistence path escapes storage root: ${filePath}`);
    }

    return resolvedPath;
  }
}
