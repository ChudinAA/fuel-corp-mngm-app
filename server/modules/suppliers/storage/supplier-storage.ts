import { eq, asc, sql, isNull, and, inArray } from "drizzle-orm";
import { db } from "server/db";
import {
  suppliers,
  supplierBases,
  storageCards,
  supplierBasisPrices,
  type Supplier,
  type InsertSupplier,
  type SupplierBasisPrice,
  currencies,
} from "@shared/schema";
import type { ISupplierStorage } from "./types";

export type SupplierBasisPriceInput = {
  basisId: string;
  servicePrice?: number | null;
  pvkjPrice?: number | null;
  agentFee?: number | null;
  otherServiceType?: string | null;
  otherServiceValue?: number | null;
};

export class SupplierStorage implements ISupplierStorage {
  private async loadBasisPrices(supplierIds: string[]): Promise<SupplierBasisPrice[]> {
    if (supplierIds.length === 0) return [];
    return db
      .select()
      .from(supplierBasisPrices)
      .where(inArray(supplierBasisPrices.supplierId, supplierIds));
  }

  async getAllSuppliers(): Promise<Supplier[]> {
    const suppliersList = await db.query.suppliers.findMany({
      where: isNull(suppliers.deletedAt),
      orderBy: (suppliers, { asc }) => [asc(suppliers.name)],
      with: {
        supplierBases: {
          with: {
            base: true,
          },
        },
        warehouse: {
          columns: {
            id: true,
            name: true,
          },
        },
      },
    });

    const allBasisPrices = await this.loadBasisPrices(suppliersList.map((s) => s.id));
    const basisPricesBySupplier = new Map<string, SupplierBasisPrice[]>();
    for (const bp of allBasisPrices) {
      if (!basisPricesBySupplier.has(bp.supplierId)) {
        basisPricesBySupplier.set(bp.supplierId, []);
      }
      basisPricesBySupplier.get(bp.supplierId)!.push(bp);
    }

    return suppliersList.map((s) => ({
      ...s,
      baseIds: s.supplierBases?.map((sb) => sb.baseId) || [],
      basisPrices: basisPricesBySupplier.get(s.id) || [],
    }));
  }

  async getSupplier(id: string): Promise<Supplier | undefined> {
    const supplier = await db.query.suppliers.findFirst({
      where: and(eq(suppliers.id, id), isNull(suppliers.deletedAt)),
      with: {
        supplierBases: {
          with: {
            base: true,
          },
        },
        warehouse: {
          columns: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!supplier) return undefined;

    const basisPrices = await this.loadBasisPrices([id]);

    return {
      ...supplier,
      baseIds: supplier.supplierBases?.map((sb) => sb.baseId) || [],
      basisPrices,
    };
  }

  async createSupplier(
    data: InsertSupplier & { baseIds?: string[]; basisPrices?: SupplierBasisPriceInput[] },
  ): Promise<Supplier> {
    const { baseIds, basisPrices, ...supplierData } = data;

    // Check for duplicates
    const existing = await db.query.suppliers.findFirst({
      where: and(
        eq(suppliers.name, supplierData.name),
        isNull(suppliers.deletedAt),
      ),
    });

    if (existing) {
      throw new Error("Такая запись уже существует");
    }

    return await db.transaction(async (tx) => {
      // Create supplier
      const [created] = await tx
        .insert(suppliers)
        .values(supplierData)
        .returning();

      // Auto-create storage card for foreign suppliers
      if (created.isForeign && !created.isIntermediary) {
        const defaultCurrency = await tx.query.currencies.findFirst({
          where: eq(currencies.code, "USD"),
        });

        const [card] = await tx
          .insert(storageCards)
          .values({
            name: created.name,
            currency: defaultCurrency?.code,
            currencySymbol: defaultCurrency?.symbol,
            currencyId: defaultCurrency?.id,
            supplierId: created.id,
          })
          .returning();

        // Link card to supplier
        await tx
          .update(suppliers)
          .set({ storageCardId: card.id })
          .where(eq(suppliers.id, created.id));

        created.storageCardId = card.id;
      }

      // Create supplier-base relations
      if (baseIds && baseIds.length > 0) {
        await tx.insert(supplierBases).values(
          baseIds.map((baseId) => ({
            supplierId: created.id,
            baseId,
          })),
        );
      }

      // Create supplier-basis price relations
      if (basisPrices && basisPrices.length > 0) {
        const pricesToInsert = basisPrices
          .filter((bp) => bp.basisId)
          .map((bp) => ({
            supplierId: created.id,
            basisId: bp.basisId,
            servicePrice: bp.servicePrice != null ? String(bp.servicePrice) : null,
            pvkjPrice: bp.pvkjPrice != null ? String(bp.pvkjPrice) : null,
            agentFee: bp.agentFee != null ? String(bp.agentFee) : null,
            otherServiceType: bp.otherServiceType || null,
            otherServiceValue: bp.otherServiceValue != null ? String(bp.otherServiceValue) : null,
          }));
        if (pricesToInsert.length > 0) {
          await tx.insert(supplierBasisPrices).values(pricesToInsert);
        }
      }

      return {
        ...created,
        baseIds: baseIds || [],
        basisPrices: [],
      };
    });
  }

  async updateSupplier(
    id: string,
    data: Partial<InsertSupplier> & { baseIds?: string[]; basisPrices?: SupplierBasisPriceInput[] },
  ): Promise<Supplier | undefined> {
    const { baseIds, basisPrices, ...supplierData } = data;

    return await db.transaction(async (tx) => {
      const currentSupplier = await tx.query.suppliers.findFirst({
        where: eq(suppliers.id, id),
      });

      if (!currentSupplier) {
        throw new Error("Такая запись не найдена");
      }

      // Auto-create storage card for foreign suppliers if its empty
      if (
        currentSupplier.storageCardId === null &&
        data.isForeign &&
        !data.isIntermediary
      ) {
        const defaultCurrency = await tx.query.currencies.findFirst({
          where: eq(currencies.code, "USD"),
        });

        const [card] = await tx
          .insert(storageCards)
          .values({
            name: data.name || currentSupplier.name,
            currency: defaultCurrency?.code,
            currencySymbol: defaultCurrency?.symbol,
            currencyId: defaultCurrency?.id,
            supplierId: currentSupplier.id,
          })
          .returning();

        // Link card to supplier
        supplierData.storageCardId = card.id;
      }

      // Update supplier
      const [updated] = await tx
        .update(suppliers)
        .set({
          ...supplierData,
          updatedAt: sql`NOW()`,
        })
        .where(eq(suppliers.id, id))
        .returning();

      if (!updated) return undefined;

      // Update supplier-base relations if baseIds provided
      if (baseIds !== undefined) {
        // Delete existing relations
        await tx.delete(supplierBases).where(eq(supplierBases.supplierId, id));

        // Create new relations
        if (baseIds.length > 0) {
          await tx.insert(supplierBases).values(
            baseIds.map((baseId) => ({
              supplierId: id,
              baseId,
            })),
          );
        }
      }

      // Update supplier-basis price relations if basisPrices provided
      if (basisPrices !== undefined) {
        await tx.delete(supplierBasisPrices).where(eq(supplierBasisPrices.supplierId, id));
        if (basisPrices.length > 0) {
          const pricesToInsert = basisPrices
            .filter((bp) => bp.basisId)
            .map((bp) => ({
              supplierId: id,
              basisId: bp.basisId,
              servicePrice: bp.servicePrice != null ? String(bp.servicePrice) : null,
              pvkjPrice: bp.pvkjPrice != null ? String(bp.pvkjPrice) : null,
              agentFee: bp.agentFee != null ? String(bp.agentFee) : null,
              otherServiceType: bp.otherServiceType || null,
              otherServiceValue: bp.otherServiceValue != null ? String(bp.otherServiceValue) : null,
            }));
          if (pricesToInsert.length > 0) {
            await tx.insert(supplierBasisPrices).values(pricesToInsert);
          }
        }
      }

      return {
        ...updated,
        baseIds: baseIds || [],
        basisPrices: [],
      };
    });
  }

  async deleteSupplier(id: string, userId?: string): Promise<boolean> {
    const currentSupplier = await db.query.suppliers.findFirst({
      where: eq(suppliers.id, id),
    });

    if (!currentSupplier) {
      throw new Error("Такая запись не найдена");
    }
    // Soft delete
    await db
      .update(suppliers)
      .set({
        deletedAt: sql`NOW()`,
        deletedById: userId,
      })
      .where(eq(suppliers.id, id));

    if (currentSupplier.storageCardId) {
      await db
        .update(storageCards)
        .set({
          deletedAt: sql`NOW()`,
          deletedById: userId,
        })
        .where(eq(storageCards.id, currentSupplier.storageCardId));
    }

    return true;
  }

  async restoreSupplier(id: string, userId?: string): Promise<boolean> {
    const currentSupplier = await db.query.suppliers.findFirst({
      where: eq(suppliers.id, id),
    });

    if (!currentSupplier) {
      throw new Error("Такая запись не найдена");
    }
    await db
      .update(suppliers)
      .set({
        deletedAt: null,
        deletedById: null,
      })
      .where(eq(suppliers.id, id));

    if (currentSupplier.storageCardId) {
      await db
        .update(storageCards)
        .set({
          deletedAt: null,
          deletedById: null,
        })
        .where(eq(storageCards.id, currentSupplier.storageCardId));
    }
    return true;
  }
}
