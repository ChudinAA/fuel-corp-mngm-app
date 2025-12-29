
import { eq, desc, sql, and, isNull } from "drizzle-orm";
import { db } from "server/db";
import { monthlyPlans, type MonthlyPlan, type InsertMonthlyPlan } from "@shared/schema";
import { IMonthlyPlanStorage } from "./types";

export class MonthlyPlanStorage implements IMonthlyPlanStorage {
  async getMonthlyPlan(id: string): Promise<MonthlyPlan | undefined> {
    return db.query.monthlyPlans.findFirst({
      where: and(eq(monthlyPlans.id, id), isNull(monthlyPlans.deletedAt)),
      with: {
        createdBy: {
          columns: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    });
  }

  async getMonthlyPlans(filters?: {
    planMonth?: string;
    planType?: string;
    baseId?: string;
  }): Promise<MonthlyPlan[]> {
    const conditions = [isNull(monthlyPlans.deletedAt)];
    
    if (filters?.planMonth) {
      conditions.push(eq(monthlyPlans.planMonth, filters.planMonth));
    }
    
    if (filters?.planType) {
      conditions.push(eq(monthlyPlans.planType, filters.planType));
    }
    
    if (filters?.baseId) {
      conditions.push(eq(monthlyPlans.baseId, filters.baseId));
    }

    return db.query.monthlyPlans.findMany({
      where: and(...conditions),
      orderBy: [desc(monthlyPlans.planMonth)],
      with: {
        createdBy: {
          columns: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    });
  }

  async createMonthlyPlan(data: InsertMonthlyPlan): Promise<MonthlyPlan> {
    const [created] = await db.insert(monthlyPlans).values(data).returning();
    return created;
  }

  async updateMonthlyPlan(
    id: string,
    data: Partial<InsertMonthlyPlan>
  ): Promise<MonthlyPlan | undefined> {
    const [updated] = await db
      .update(monthlyPlans)
      .set({
        ...data,
        updatedAt: sql`NOW()`,
      })
      .where(eq(monthlyPlans.id, id))
      .returning();

    return updated;
  }

  async deleteMonthlyPlan(id: string, userId?: string): Promise<boolean> {
    await db
      .update(monthlyPlans)
      .set({
        deletedAt: sql`NOW()`,
        deletedById: userId,
      })
      .where(eq(monthlyPlans.id, id));

    return true;
  }
}
