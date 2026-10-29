
import { eq, desc, sql, and, isNull, gte, lt, lte } from "drizzle-orm";
import { db } from "server/db";
import { budgetIncomeExpense, type BudgetIncomeExpense, type InsertBudgetIncomeExpense } from "@shared/schema";
import { getBudgetMonthRange } from "./budget-month-range";
import { opt } from "../../opt/entities/opt";
import { optMassTonnesSql } from "../../opt/opt-mass-sql";
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
    const salesTotals = await this.getMonthlySalesTotals(budget.budgetMonth);
    const totalRevenue = Number(salesTotals.totalRevenue);
    const totalProfit = Number(salesTotals.totalProfit);
    const marginality = totalRevenue > 0
      ? ((totalProfit / totalRevenue) * 100).toFixed(2)
      : "0";

    await this.updateBudgetEntry(budgetId, {
      salesVolumeTonnes: salesTotals.totalVolumeTonnes,
      marginality,
    });

    return {
      budgetId,
      period: budget.budgetMonth,
      salesVolumeTonnes: salesTotals.totalVolumeTonnes,
      revenue: salesTotals.totalRevenue,
      profit: salesTotals.totalProfit,
      marginality,
    };
  }

  async calculateBudgetMetrics(budgetId: string): Promise<any> {
    const budget = await this.getBudgetEntry(budgetId);
    
    if (!budget) {
      throw new Error("Budget not found");
    }

    const revenue = parseFloat(budget.salesRevenue || "0");
    const operatingExpenses = parseFloat(budget.operatingExpenses || "0");
    const otherExpenses = parseFloat(budget.otherExpenses || "0");
    const totalExpenses = operatingExpenses + otherExpenses;

    const grossProfit = revenue - totalExpenses;
    const marginality = revenue > 0 ? (grossProfit / revenue) * 100 : 0;
    const ebitda = grossProfit; // Упрощенный расчет

    return {
      budgetId,
      period: budget.budgetMonth,
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
    const { start, end } = getBudgetMonthRange(budgetMonth);
    const salesTotals = await this.getMonthlySalesTotals(budgetMonth);
    const totalRevenue = Number(salesTotals.totalRevenue);
    const totalProfit = Number(salesTotals.totalProfit);
    const marginality = totalRevenue > 0
      ? ((totalProfit / totalRevenue) * 100).toFixed(2)
      : "0";

    // Проверяем, существует ли запись для этого месяца
    const [existing] = await db
      .select()
      .from(budgetIncomeExpense)
      .where(
        and(
          gte(budgetIncomeExpense.budgetMonth, start),
          lt(budgetIncomeExpense.budgetMonth, end),
          isNull(budgetIncomeExpense.deletedAt)
        )
      )
      .limit(1);

    if (existing) {
      return this.updateBudgetEntry(existing.id, {
        salesVolumeTonnes: salesTotals.totalVolumeTonnes,
        salesRevenue: salesTotals.totalRevenue,
        marginality: marginality,
      });
    }

    return undefined;
  }

  private async getMonthlySalesTotals(budgetMonth: string): Promise<{
    totalVolumeTonnes: string;
    totalRevenue: string;
    totalProfit: string;
  }> {
    const { start, end } = getBudgetMonthRange(budgetMonth);
    const result = await db.execute(sql`
      WITH monthly_sales AS (
        SELECT
          CASE
            WHEN CAST(COALESCE(${opt.quantityLiters}, '0') AS NUMERIC) > 0
              AND CAST(COALESCE(${opt.density}, '0') AS NUMERIC) > 0
            THEN CAST(${opt.quantityLiters} AS NUMERIC)
              * CAST(${opt.density} AS NUMERIC) / 1000
            ELSE ${optMassTonnesSql()}
          END AS volume_tonnes,
          CAST(${opt.saleAmount} AS NUMERIC) AS revenue,
          CAST(${opt.profit} AS NUMERIC) AS profit
        FROM ${opt}
        WHERE ${opt.dealDate} >= ${start}::timestamp
          AND ${opt.dealDate} < ${end}::timestamp
          AND ${opt.deletedAt} IS NULL

        UNION ALL

        SELECT
          CASE
            WHEN CAST(COALESCE(${aircraftRefueling.quantityLiters}, '0') AS NUMERIC) > 0
              AND CAST(COALESCE(${aircraftRefueling.density}, '0') AS NUMERIC) > 0
            THEN CAST(${aircraftRefueling.quantityLiters} AS NUMERIC)
              * CAST(${aircraftRefueling.density} AS NUMERIC) / 1000
            ELSE ${aircraftRefueling.quantityTonnes}
          END AS volume_tonnes,
          CAST(${aircraftRefueling.saleAmount} AS NUMERIC) AS revenue,
          CAST(${aircraftRefueling.profit} AS NUMERIC) AS profit
        FROM ${aircraftRefueling}
        WHERE ${aircraftRefueling.refuelingDate} >= ${start}::timestamp
          AND ${aircraftRefueling.refuelingDate} < ${end}::timestamp
          AND ${aircraftRefueling.deletedAt} IS NULL
      )
      SELECT
        COALESCE(ROUND(SUM(monthly_sales.volume_tonnes), 5), 0)::text AS total_volume_tonnes,
        COALESCE(SUM(monthly_sales.revenue), 0)::text AS total_revenue,
        COALESCE(SUM(monthly_sales.profit), 0)::text AS total_profit
      FROM monthly_sales
    `);
    const totals = result.rows?.[0] as {
      total_volume_tonnes?: string;
      total_revenue?: string;
      total_profit?: string;
    } | undefined;

    if (!totals) {
      throw new Error("Could not calculate monthly sales totals");
    }

    return {
      totalVolumeTonnes: totals.total_volume_tonnes ?? "0",
      totalRevenue: totals.total_revenue ?? "0",
      totalProfit: totals.total_profit ?? "0",
    };
  }
}
