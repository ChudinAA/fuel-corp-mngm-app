import { eq, or, asc, sql, isNull, and } from "drizzle-orm";
import { db } from "server/db";
import {
  customerBases,
  customers,
  type Customer,
  type InsertCustomer,
} from "@shared/schema";
import type { ICustomerStorage } from "./types";

export class CustomerStorage implements ICustomerStorage {
  async getAllCustomers(module?: string): Promise<Customer[]> {
    const customersList = await db.query.customers.findMany({
      where: isNull(customers.deletedAt),
      orderBy: (customers, { asc }) => [asc(customers.name)],
      with: {
        customerBases: {
          with: {
            base: true,
          },
        },
      },
    });

    // Map to include baseIds for backward compatibility
    return customersList.map((c) => ({
      ...c,
      baseIds: c.customerBases?.map((cb) => cb.baseId) || [],
    }));
  }

  async getCustomer(id: string): Promise<Customer | undefined> {
    const customer = await db.query.customers.findFirst({
      where: and(eq(customers.id, id), isNull(customers.deletedAt)),
      with: {
        customerBases: {
          with: {
            base: true,
          },
        },
      },
    });

    if (!customer) return undefined;

    // Map to include baseIds for backward compatibility
    return {
      ...customer,
      baseIds: customer.customerBases?.map((cb) => cb.baseId) || [],
    };
  }

  async createCustomer(
    data: InsertCustomer & { baseIds?: string[] },
  ): Promise<Customer> {
    const { baseIds, ...customerData } = data;
    // Check for duplicates
    const [existing] = await db
      .select()
      .from(customers)
      .where(and(eq(customers.name, data.name), isNull(customers.deletedAt)))
      .limit(1);

    if (existing) {
      throw new Error("Такая запись уже существует");
    }

    return await db.transaction(async (tx) => {
      // Create supplier
      const [created] = await tx
        .insert(customers)
        .values(customerData)
        .returning();

      // Create supplier-base relations
      if (baseIds && baseIds.length > 0) {
        await tx.insert(customerBases).values(
          baseIds.map((baseId) => ({
            customerId: created.id,
            baseId,
          })),
        );
      }

      return {
        ...created,
        baseIds: baseIds || [],
      };
    });
  }

  async updateCustomer(
    id: string,
    data: InsertCustomer & { baseIds?: string[] },
  ): Promise<Customer | undefined> {
    const { baseIds, ...customerData } = data;

    return await db.transaction(async (tx) => {
      // Update supplier
      const [updated] = await tx
        .update(customers)
        .set({
          ...customerData,
          updatedAt: sql`NOW()`,
        })
        .where(eq(customers.id, id))
        .returning();

      if (!updated) return undefined;

      // Update supplier-base relations if baseIds provided
      if (baseIds !== undefined) {
        // Delete existing relations
        await tx.delete(customerBases).where(eq(customerBases.customerId, id));

        // Create new relations
        if (baseIds.length > 0) {
          await tx.insert(customerBases).values(
            baseIds.map((baseId) => ({
              customerId: id,
              baseId,
            })),
          );
        }
      }

      return {
        ...updated,
        baseIds: baseIds || [],
      };
    });
  }

  async deleteCustomer(id: string, userId?: string): Promise<boolean> {
    // Soft delete
    await db
      .update(customers)
      .set({
        deletedAt: sql`NOW()`,
        deletedById: userId,
      })
      .where(eq(customers.id, id));
    return true;
  }

  async restoreCustomer(id: string, userId?: string): Promise<boolean> {
    await db
      .update(customers)
      .set({
        deletedAt: null,
        deletedById: null,
      })
      .where(eq(customers.id, id));
    return true;
  }
}
