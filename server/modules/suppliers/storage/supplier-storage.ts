import { eq, asc, sql, isNull, and } from "drizzle-orm";
import { db } from "server/db";
import {
  suppliers,
  supplierBases,
  type Supplier,
  type InsertSupplier,
} from "@shared/schema";
import type { ISupplierStorage } from "./types";

export class SupplierStorage implements ISupplierStorage {
  async getAllSuppliers(): Promise<Supplier[]> {
    const suppliersList = await db.query.suppliers.findMany({
      where: isNull(suppliers.deletedAt),
      orderBy: (suppliers, { asc }) => [asc(suppliers.name)],
      with: {
        supplierBases: {
          with: {
            base: true,
          }
        },
        warehouse: {
          columns: {
            id: true,
            name: true,
          }
        }
      }
    });

    // Map to include baseIds for backward compatibility
    return suppliersList.map(s => ({
      ...s,
      baseIds: s.supplierBases?.map(sb => sb.baseId) || [],
    }));
  }

  async getSupplier(id: string): Promise<Supplier | undefined> {
    const supplier = await db.query.suppliers.findFirst({
      where: and(eq(suppliers.id, id), isNull(suppliers.deletedAt)),
      with: {
        supplierBases: {
          with: {
            base: true,
          }
        },
        warehouse: {
          columns: {
            id: true,
            name: true,
          }
        }
      }
    });

    if (!supplier) return undefined;

    // Map to include baseIds for backward compatibility
    return {
      ...supplier,
      baseIds: supplier.supplierBases?.map(sb => sb.baseId) || [],
    };
  }

  async createSupplier(data: InsertSupplier & { baseIds?: string[] }): Promise<Supplier> {
    const { baseIds, ...supplierData } = data;

    return await db.transaction(async (tx) => {
      // Create supplier
      const [created] = await tx.insert(suppliers).values(supplierData).returning();

      // Create supplier-base relations
      if (baseIds && baseIds.length > 0) {
        await tx.insert(supplierBases).values(
          baseIds.map(baseId => ({
            supplierId: created.id,
            baseId,
          }))
        );
      }

      return {
        ...created,
        baseIds: baseIds || [],
      };
    });
  }

  async updateSupplier(id: string, data: Partial<InsertSupplier> & { baseIds?: string[] }): Promise<Supplier | undefined> {
    const { baseIds, ...supplierData } = data;

    return await db.transaction(async (tx) => {
      // Update supplier
      const [updated] = await tx.update(suppliers).set({
        ...supplierData,
        updatedAt: sql`NOW()`
      }).where(eq(suppliers.id, id)).returning();

      if (!updated) return undefined;

      // Update supplier-base relations if baseIds provided
      if (baseIds !== undefined) {
        // Delete existing relations
        await tx.delete(supplierBases).where(eq(supplierBases.supplierId, id));

        // Create new relations
        if (baseIds.length > 0) {
          await tx.insert(supplierBases).values(
            baseIds.map(baseId => ({
              supplierId: id,
              baseId,
            }))
          );
        }
      }

      return {
        ...updated,
        baseIds: baseIds || [],
      };
    });
  }

  async deleteSupplier(id: string, userId?: string): Promise<boolean> {
    // Soft delete
    await db.update(suppliers).set({
      deletedAt: sql`NOW()`,
      deletedById: userId,
    }).where(eq(suppliers.id, id));
    return true;
  }

  async restoreSupplier(id: string, userId?: string): Promise<boolean> {
    await db.update(suppliers).set({
      deletedAt: null,
      deletedById: null,
    }).where(eq(suppliers.id, id));
    return true;
  }
}