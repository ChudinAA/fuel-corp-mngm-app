
import { eq, desc, sql, and, isNull, gte, lte } from "drizzle-orm";
import { db } from "server/db";
import { monthlyPlans, type MonthlyPlan, type InsertMonthlyPlan, opt, aircraftRefueling, warehouseTransactions } from "@shared/schema";
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
        base: true,
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
        base: true,
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

  async getPlanVsActual(planId: string): Promise<any> {
    const plan = await this.getMonthlyPlan(planId);
    
    if (!plan) {
      throw new Error("Plan not found");
    }

    const periodStart = plan.month;
    const periodEnd = new Date(new Date(plan.month).setMonth(new Date(plan.month).getMonth() + 1)).toISOString();

    // Фактические продажи ОПТ
    const [optActual] = await db
      .select({
        actualVolume: sql<string>`COALESCE(SUM(CAST(${opt.quantityKg} AS NUMERIC)), 0)`,
        actualRevenue: sql<string>`COALESCE(SUM(CAST(${opt.saleAmount} AS NUMERIC)), 0)`,
      })
      .from(opt)
      .where(
        and(
          gte(opt.dealDate, periodStart),
          lte(opt.dealDate, periodEnd),
          eq(opt.warehouseId, plan.baseId!),
          isNull(opt.deletedAt)
        )
      );

    // Фактические продажи ЗВС
    const [refuelingActual] = await db
      .select({
        actualVolume: sql<string>`COALESCE(SUM(CAST(${aircraftRefueling.quantityKg} AS NUMERIC)), 0)`,
        actualRevenue: sql<string>`COALESCE(SUM(CAST(${aircraftRefueling.saleAmount} AS NUMERIC)), 0)`,
      })
      .from(aircraftRefueling)
      .where(
        and(
          gte(aircraftRefueling.refuelingDate, periodStart),
          lte(aircraftRefueling.refuelingDate, periodEnd),
          isNull(aircraftRefueling.deletedAt)
        )
      );

    // Фактические остатки на складах
    const [warehouseActual] = await db
      .select({
        actualBalance: sql<string>`COALESCE(SUM(CAST(${warehouseTransactions.balanceKg} AS NUMERIC)), 0)`,
      })
      .from(warehouseTransactions)
      .where(
        and(
          eq(warehouseTransactions.warehouseId, plan.baseId!),
          isNull(warehouseTransactions.deletedAt)
        )
      );

    return {
      plan: {
        optSales: plan.plannedOptSales,
        refuelingSales: plan.plannedRefuelingSales,
        warehouseBalance: plan.plannedWarehouseBalance,
      },
      actual: {
        optSales: optActual?.actualRevenue || "0",
        refuelingSales: refuelingActual?.actualRevenue || "0",
        warehouseBalance: warehouseActual?.actualBalance || "0",
      },
      variance: {
        optSales: (parseFloat(optActual?.actualRevenue || "0") - parseFloat(plan.plannedOptSales || "0")).toString(),
        refuelingSales: (parseFloat(refuelingActual?.actualRevenue || "0") - parseFloat(plan.plannedRefuelingSales || "0")).toString(),
        warehouseBalance: (parseFloat(warehouseActual?.actualBalance || "0") - parseFloat(plan.plannedWarehouseBalance || "0")).toString(),
      },
    };
  }

  async copyPlan(sourcePlanId: string, targetMonth: string, userId: string): Promise<any> {
    const sourcePlan = await this.getMonthlyPlan(sourcePlanId);
    
    if (!sourcePlan) {
      throw new Error("Source plan not found");
    }

    const newPlan = await this.createMonthlyPlan({
      month: targetMonth,
      baseId: sourcePlan.baseId,
      plannedOptSales: sourcePlan.plannedOptSales,
      plannedRefuelingSales: sourcePlan.plannedRefuelingSales,
      plannedWarehouseBalance: sourcePlan.plannedWarehouseBalance,
      notes: `Copied from ${sourcePlan.month}`,
      createdById: userId,
    });

    return newPlan;
  }

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
