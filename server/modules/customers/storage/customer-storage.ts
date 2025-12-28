import { eq, or, asc, sql, isNull, and } from "drizzle-orm";
import { db } from "server/db";
import { customers, type Customer, type InsertCustomer } from "@shared/schema";
import type { ICustomerStorage } from "./types";

export class CustomerStorage implements ICustomerStorage {
  async getAllCustomers(module?: string): Promise<Customer[]> {
    if (module && module !== "all") {
      return db
        .select()
        .from(customers)
        .where(and(
          or(eq(customers.module, module), eq(customers.module, "both")),
          isNull(customers.deletedAt)
        ))
        .orderBy(asc(customers.name));
    }
    return db.select().from(customers).where(isNull(customers.deletedAt)).orderBy(asc(customers.name));
  }

  async getCustomer(id: string): Promise<Customer | undefined> {
    const [customer] = await db
      .select()
      .from(customers)
      .where(and(eq(customers.id, id), isNull(customers.deletedAt)))
      .limit(1);
    return customer;
  }

  async createCustomer(data: InsertCustomer): Promise<Customer> {
    const [customer] = await db.insert(customers).values(data).returning();
    return customer;
  }

  async updateCustomer(id: string, data: InsertCustomer): Promise<Customer> {
    const [customer] = await db
      .update(customers)
      .set({
        ...data,
        updatedAt: sql`NOW()`,
      })
      .where(eq(customers.id, id))
      .returning();
    return customer;
  }

  async deleteCustomer(id: string, userId?: string): Promise<boolean> {
    // Soft delete
    await db.update(customers).set({
      deletedAt: sql`NOW()`,
      deletedById: userId,
    }).where(eq(customers.id, id));
    return true;
  }

  async restoreCustomer(id: string, userId?: string): Promise<boolean> {
    await db.update(customers).set({
      deletedAt: null,
      deletedById: null,
    }).where(eq(customers.id, id));
    return true;
  }
}
