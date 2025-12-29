import { db } from "../../../db";
import { paymentCalendar } from "../entities/finance";
import type { InsertPaymentCalendarItem } from "./types";
import { eq, and, isNull, desc, gte, lte, sql } from "drizzle-orm";

export async function createPaymentCalendarItem(data: InsertPaymentCalendarItem) {
  const [item] = await db.insert(paymentCalendar).values(data).returning();
  return item;
}

export async function getPaymentCalendarItems(filters?: {
  startDate?: string;
  endDate?: string;
  status?: string;
  category?: string;
}) {
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

export async function getPaymentCalendarItemById(id: string) {
  const [item] = await db
    .select()
    .from(paymentCalendar)
    .where(and(eq(paymentCalendar.id, id), isNull(paymentCalendar.deletedAt)));
  return item;
}

export async function updatePaymentCalendarItem(id: string, data: Partial<InsertPaymentCalendarItem>) {
  const [updated] = await db
    .update(paymentCalendar)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(paymentCalendar.id, id))
    .returning();
  return updated;
}

export async function deletePaymentCalendarItem(id: string, userId: string) {
  const [deleted] = await db
    .update(paymentCalendar)
    .set({ deletedAt: new Date(), deletedById: userId })
    .where(eq(paymentCalendar.id, id))
    .returning();
  return deleted;
}

export async function getUpcomingPayments(daysAhead: number = 7) {
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

import { PaymentCalendarStorage } from "./payment-calendar-storage-class";

export const paymentCalendarStorage = new PaymentCalendarStorage();