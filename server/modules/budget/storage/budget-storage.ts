
import { eq, desc, sql, and, isNull, gte, lte } from "drizzle-orm";
import { db } from "server/db";
import { budgetIncomeExpense, type BudgetIncomeExpense, type InsertBudgetIncomeExpense } from "@shared/schema";
import { opt } from "../../opt/entities/opt";
import { aircraftRefueling } from "../../refueling/entities/refueling";
import { IBudgetStorage } from "./types";

export class BudgetStorage implements IBudgetStorage {
  async getBudgetEntry(id: string): Promise<BudgetIncomeExpense | undefined> {
    return db.query.budgetIncomeExpense.findFirst({
      where: and(eq(budgetIncomeExpense.id, id), isNull(budgetIncomeExpense.deletedAt)),
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

  async getBudgetEntries(filters?: {
    startMonth?: string;
    endMonth?: string;
  }): Promise<BudgetIncomeExpense[]> {
    const conditions = [isNull(budgetIncomeExpense.deletedAt)];
    
    if (filters?.startMonth) {
      conditions.push(gte(budgetIncomeExpense.budgetMonth, filters.startMonth));
    }
    
    if (filters?.endMonth) {
      conditions.push(lte(budgetIncomeExpense.budgetMonth, filters.endMonth));
    }

    return db.query.budgetIncomeExpense.findMany({
      where: and(...conditions),
      orderBy: [desc(budgetIncomeExpense.budgetMonth)],
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

  async createBudgetEntry(data: InsertBudgetIncomeExpense): Promise<BudgetIncomeExpense> {
    const [created] = await db.insert(budgetIncomeExpense).values(data).returning();
    return created;
  }

  async updateBudgetEntry(
    id: string,
    data: Partial<InsertBudgetIncomeExpense>
  ): Promise<BudgetIncomeExpense | undefined> {
    const [updated] = await db
      .update(budgetIncomeExpense)
      .set({
        ...data,
        updatedAt: sql`NOW()`,
      })
      .where(eq(budgetIncomeExpense.id, id))
      .returning();

    return updated;
  }

  async autoFillFromSales(budgetId: string): Promise<any> {
    const budget = await this.getBudgetEntry(budgetId);
    
    if (!budget) {
      throw new Error("Budget not found");
    }

    const periodStart = budget.month;
    const periodEnd = new Date(new Date(budget.month).setMonth(new Date(budget.month).getMonth() + 1)).toISOString();

    // Получаем продажи за период
    const [salesData] = await db
      .select({
        optRevenue: sql<string>`COALESCE(SUM(CASE WHEN ${opt.dealDate} >= ${periodStart} AND ${opt.dealDate} < ${periodEnd} THEN CAST(${opt.saleAmount} AS NUMERIC) ELSE 0 END), 0)`,
        optProfit: sql<string>`COALESCE(SUM(CASE WHEN ${opt.dealDate} >= ${periodStart} AND ${opt.dealDate} < ${periodEnd} THEN CAST(${opt.profit} AS NUMERIC) ELSE 0 END), 0)`,
        refuelingRevenue: sql<string>`COALESCE(SUM(CASE WHEN ${aircraftRefueling.refuelingDate} >= ${periodStart} AND ${aircraftRefueling.refuelingDate} < ${periodEnd} THEN CAST(${aircraftRefueling.saleAmount} AS NUMERIC) ELSE 0 END), 0)`,
        refuelingProfit: sql<string>`COALESCE(SUM(CASE WHEN ${aircraftRefueling.refuelingDate} >= ${periodStart} AND ${aircraftRefueling.refuelingDate} < ${periodEnd} THEN CAST(${aircraftRefueling.profit} AS NUMERIC) ELSE 0 END), 0)`,
      })
      .from(opt)
      .leftJoin(aircraftRefueling, sql`1=1`)
      .where(
        and(
          isNull(opt.deletedAt),
          isNull(aircraftRefueling.deletedAt)
        )
      );

    const totalRevenue = (
      parseFloat(salesData?.optRevenue || "0") + 
      parseFloat(salesData?.refuelingRevenue || "0")
    ).toString();

    const totalProfit = (
      parseFloat(salesData?.optProfit || "0") + 
      parseFloat(salesData?.refuelingProfit || "0")
    ).toString();

    // Обновляем бюджет
    await this.updateBudgetEntry(budgetId, {
      salesVolume: totalRevenue,
      marginality: parseFloat(totalRevenue) > 0 
        ? ((parseFloat(totalProfit) / parseFloat(totalRevenue)) * 100).toFixed(2)
        : "0",
    });

    return {
      budgetId,
      period: budget.month,
      revenue: totalRevenue,
      profit: totalProfit,
      marginality: parseFloat(totalRevenue) > 0 
        ? ((parseFloat(totalProfit) / parseFloat(totalRevenue)) * 100).toFixed(2)
        : "0",
    };
  }

  async calculateBudgetMetrics(budgetId: string): Promise<any> {
    const budget = await this.getBudgetEntry(budgetId);
    
    if (!budget) {
      throw new Error("Budget not found");
    }

    const revenue = parseFloat(budget.actualSalesVolume || budget.plannedSalesVolume || "0");
    const operatingExpenses = parseFloat(budget.operatingExpenses || "0");
    const otherExpenses = parseFloat(budget.otherExpenses || "0");
    const totalExpenses = operatingExpenses + otherExpenses;

    const grossProfit = revenue - totalExpenses;
    const marginality = revenue > 0 ? (grossProfit / revenue) * 100 : 0;
    const ebitda = grossProfit; // Упрощенный расчет

    return {
      budgetId,
      period: budget.month,
      metrics: {
        revenue: revenue.toString(),
        operatingExpenses: operatingExpenses.toString(),
        otherExpenses: otherExpenses.toString(),
        totalExpenses: totalExpenses.toString(),
        grossProfit: grossProfit.toString(),
        marginality: marginality.toFixed(2),
        ebitda: ebitda.toString(),
        roiPercent: revenue > 0 ? ((grossProfit / totalExpenses) * 100).toFixed(2) : "0",
      },
    };
  }

  async deleteBudgetEntry(id: string, userId?: string): Promise<boolean> {
    await db
      .update(budgetIncomeExpense)
      .set({
        deletedAt: sql`NOW()`,
        deletedById: userId,
      })
      .where(eq(budgetIncomeExpense.id, id));

    return true;
  }

  async updateBudgetFromSales(budgetMonth: string): Promise<BudgetIncomeExpense | undefined> {
    // Определяем начало и конец месяца
    const monthDate = new Date(budgetMonth);
    const monthStart = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1).toISOString();
    const monthEnd = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0, 23, 59, 59).toISOString();

    // Агрегация данных из ОПТа
    const [optData] = await db
      .select({
        totalVolume: sql<string>`COALESCE(SUM(CAST(${opt.quantityKg} AS NUMERIC)), 0)`,
        totalRevenue: sql<string>`COALESCE(SUM(CAST(${opt.saleAmount} AS NUMERIC)), 0)`,
        totalProfit: sql<string>`COALESCE(SUM(CAST(${opt.profit} AS NUMERIC)), 0)`,
      })
      .from(opt)
      .where(
        and(
          gte(opt.dealDate, monthStart),
          lte(opt.dealDate, monthEnd),
          isNull(opt.deletedAt)
        )
      );

    // Агрегация данных из ЗВС
    const [refuelingData] = await db
      .select({
        totalVolume: sql<string>`COALESCE(SUM(CAST(${aircraftRefueling.quantityKg} AS NUMERIC)), 0)`,
        totalRevenue: sql<string>`COALESCE(SUM(CAST(${aircraftRefueling.saleAmount} AS NUMERIC)), 0)`,
        totalProfit: sql<string>`COALESCE(SUM(CAST(${aircraftRefueling.profit} AS NUMERIC)), 0)`,
      })
      .from(aircraftRefueling)
      .where(
        and(
          gte(aircraftRefueling.refuelingDate, monthStart),
          lte(aircraftRefueling.refuelingDate, monthEnd),
          isNull(aircraftRefueling.deletedAt)
        )
      );

    const totalVolume = (
      parseFloat(optData?.totalVolume || "0") + 
      parseFloat(refuelingData?.totalVolume || "0")
    ).toString();

    const totalRevenue = (
      parseFloat(optData?.totalRevenue || "0") + 
      parseFloat(refuelingData?.totalRevenue || "0")
    ).toString();

    const totalProfit = (
      parseFloat(optData?.totalProfit || "0") + 
      parseFloat(refuelingData?.totalProfit || "0")
    ).toString();

    const marginality = parseFloat(totalRevenue) > 0 
      ? ((parseFloat(totalProfit) / parseFloat(totalRevenue)) * 100).toFixed(2)
      : "0";

    // Проверяем, существует ли запись для этого месяца
    const [existing] = await db
      .select()
      .from(budgetIncomeExpense)
      .where(
        and(
          eq(budgetIncomeExpense.budgetMonth, monthStart),
          isNull(budgetIncomeExpense.deletedAt)
        )
      )
      .limit(1);

    if (existing) {
      return this.updateBudgetEntry(existing.id, {
        salesVolume: totalVolume,
        salesRevenue: totalRevenue,
        marginality: marginality,
      });
    }

    return undefined;
  }
}
