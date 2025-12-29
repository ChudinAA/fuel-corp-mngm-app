
import { db } from "../../../db";
import { paymentCalendar } from "../entities/finance";
import type { InsertPaymentCalendarItem, PaymentCalendarItem } from "./types";
import { eq, and, isNull, gte, lte, sql } from "drizzle-orm";

export interface IPaymentCalendarStorage {
  getPaymentCalendarItem(id: string): Promise<PaymentCalendarItem | undefined>;
  getPaymentCalendarItems(filters?: {
    startDate?: string;
    endDate?: string;
    status?: string;
    category?: string;
  }): Promise<PaymentCalendarItem[]>;
  getUpcomingPayments(daysAhead?: number): Promise<PaymentCalendarItem[]>;
  createPaymentCalendarItem(data: InsertPaymentCalendarItem): Promise<PaymentCalendarItem>;
  updatePaymentCalendarItem(id: string, data: Partial<InsertPaymentCalendarItem>): Promise<PaymentCalendarItem | undefined>;
  deletePaymentCalendarItem(id: string, userId?: string): Promise<boolean>;
  restorePaymentCalendarItem(id: string, userId?: string): Promise<boolean>;
}

export class PaymentCalendarStorage implements IPaymentCalendarStorage {
  async getPaymentCalendarItem(id: string): Promise<PaymentCalendarItem | undefined> {
    const [item] = await db
      .select()
      .from(paymentCalendar)
      .where(and(eq(paymentCalendar.id, id), isNull(paymentCalendar.deletedAt)))
      .limit(1);
    return item;
  }

  async getPaymentCalendarItems(filters?: {
    startDate?: string;
    endDate?: string;
    status?: string;
    category?: string;
  }): Promise<PaymentCalendarItem[]> {
    let query = db.select().from(paymentCalendar).where(isNull(paymentCalendar.deletedAt));

    if (filters?.startDate) {
      query = query.where(gte(paymentCalendar.dueDate, filters.startDate)) as typeof query;
    }
    if (filters?.endDate) {
      query = query.where(lte(paymentCalendar.dueDate, filters.endDate)) as typeof query;
    }
    if (filters?.status) {
      query = query.where(eq(paymentCalendar.status, filters.status)) as typeof query;
    }
    if (filters?.category) {
      query = query.where(eq(paymentCalendar.category, filters.category)) as typeof query;
    }

    return await query.orderBy(paymentCalendar.dueDate);
  }

  async getUpcomingPayments(daysAhead: number = 7): Promise<PaymentCalendarItem[]> {
    const today = new Date();
    const futureDate = new Date();
    futureDate.setDate(today.getDate() + daysAhead);

    return await db
      .select()
      .from(paymentCalendar)
      .where(
        and(
          isNull(paymentCalendar.deletedAt),
          eq(paymentCalendar.status, "pending"),
          gte(paymentCalendar.dueDate, today.toISOString().split('T')[0]),
          lte(paymentCalendar.dueDate, futureDate.toISOString().split('T')[0])
        )
      )
      .orderBy(paymentCalendar.dueDate);
  }

  async createPaymentCalendarItem(data: InsertPaymentCalendarItem): Promise<PaymentCalendarItem> {
    const [item] = await db.insert(paymentCalendar).values(data).returning();
    return item;
  }

  async updatePaymentCalendarItem(id: string, data: Partial<InsertPaymentCalendarItem>): Promise<PaymentCalendarItem | undefined> {
    const [updated] = await db
      .update(paymentCalendar)
      .set({ ...data, updatedAt: sql`NOW()` })
      .where(eq(paymentCalendar.id, id))
      .returning();
    return updated;
  }

  async deletePaymentCalendarItem(id: string, userId?: string): Promise<boolean> {
    await db
      .update(paymentCalendar)
      .set({ deletedAt: sql`NOW()`, deletedById: userId })
      .where(eq(paymentCalendar.id, id));
    return true;
  }

  async restorePaymentCalendarItem(id: string, userId?: string): Promise<boolean> {
    await db
      .update(paymentCalendar)
      .set({ deletedAt: null, deletedById: null })
      .where(eq(paymentCalendar.id, id));
    return true;
  }
}
