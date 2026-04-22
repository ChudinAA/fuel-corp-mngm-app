import { eq, isNull, and, desc } from "drizzle-orm";
import { db } from "server/db";
import { baseDeliveryTariffs, type BaseDeliveryTariff, type InsertBaseDeliveryTariff } from "../entities/base-delivery-tariffs";
import { bases } from "../../bases/entities/bases";

export class BaseDeliveryTariffsStorage {
  async getAll(): Promise<any[]> {
    return db.query.baseDeliveryTariffs.findMany({
      where: isNull(baseDeliveryTariffs.deletedAt),
      orderBy: [desc(baseDeliveryTariffs.createdAt)],
      with: { fromBase: true, toBase: true },
    });
  }

  async getById(id: string): Promise<any | undefined> {
    return db.query.baseDeliveryTariffs.findFirst({
      where: and(eq(baseDeliveryTariffs.id, id), isNull(baseDeliveryTariffs.deletedAt)),
      with: { fromBase: true, toBase: true },
    });
  }

  async getByBasePair(fromBaseId: string, toBaseId: string): Promise<BaseDeliveryTariff | undefined> {
    return db.query.baseDeliveryTariffs.findFirst({
      where: and(
        eq(baseDeliveryTariffs.fromBaseId, fromBaseId),
        eq(baseDeliveryTariffs.toBaseId, toBaseId),
        isNull(baseDeliveryTariffs.deletedAt),
        eq(baseDeliveryTariffs.isActive, true),
      ),
    });
  }

  async create(data: InsertBaseDeliveryTariff): Promise<BaseDeliveryTariff> {
    const [tariff] = await db.insert(baseDeliveryTariffs).values(data).returning();
    return tariff;
  }

  async update(id: string, data: Partial<InsertBaseDeliveryTariff>): Promise<BaseDeliveryTariff | undefined> {
    const [tariff] = await db
      .update(baseDeliveryTariffs)
      .set({ ...data, updatedAt: new Date().toISOString() })
      .where(and(eq(baseDeliveryTariffs.id, id), isNull(baseDeliveryTariffs.deletedAt)))
      .returning();
    return tariff;
  }

  async delete(id: string): Promise<void> {
    await db
      .update(baseDeliveryTariffs)
      .set({ deletedAt: new Date().toISOString() })
      .where(eq(baseDeliveryTariffs.id, id));
  }
}

export const baseDeliveryTariffsStorage = new BaseDeliveryTariffsStorage();
