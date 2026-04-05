import { db } from "server/db";
import { eq } from "drizzle-orm";
import { appSettings } from "../entities/settings";

export class SettingsStorage {
  async get(key: string): Promise<string | null> {
    const row = await db.query.appSettings.findFirst({
      where: eq(appSettings.key, key),
    });
    return row?.value ?? null;
  }

  async set(key: string, value: string): Promise<void> {
    await db
      .insert(appSettings)
      .values({ key, value })
      .onConflictDoUpdate({
        target: appSettings.key,
        set: { value, updatedAt: new Date() },
      });
  }
}
