
import { eq, desc, sql, and, isNull, gte, lte } from "drizzle-orm";
import { optMassTonnesSql } from "../../opt/opt-mass-sql";
import { db } from "server/db";
import { managementReports, type ManagementReport, type InsertManagementReport } from "@shared/schema";
import { opt } from "../../opt/entities/opt";
import { aircraftRefueling } from "../../refueling/entities/refueling";
import { warehouseTransactions } from "../../warehouses/entities/warehouses";
import { movement } from "../../movement/entities/movement";
import { exchangeDeals } from "../../exchange-deals/entities/exchange-deals";
import { cashflowTransactions } from "../../finance/entities/finance";
import { governmentContracts } from "../../gov-contracts/entities/gov-contracts";
import { deliveryCost } from "../../delivery/entities/delivery";
import { IManagementReportStorage, ManagementReportData } from "./types";

export class ManagementReportStorage implements IManagementReportStorage {
  async getManagementReport(id: string): Promise<ManagementReport | undefined> {
    return db.query.managementReports.findFirst({
      where: and(eq(managementReports.id, id), isNull(managementReports.deletedAt)),
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

  async getManagementReports(filters?: {
    startDate?: string;
    endDate?: string;
  }): Promise<ManagementReport[]> {
    const conditions = [isNull(managementReports.deletedAt)];
    
    if (filters?.startDate) {
      conditions.push(gte(managementReports.periodStart, filters.startDate));
    }
    
    if (filters?.endDate) {
      conditions.push(lte(managementReports.periodEnd, filters.endDate));
    }

    return db.query.managementReports.findMany({
      where: and(...conditions),
      orderBy: [desc(managementReports.periodStart)],
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

  async createManagementReport(data: InsertManagementReport): Promise<ManagementReport> {
    const [created] = await db.insert(managementReports).values(data).returning();
    return created;
  }

  async updateManagementReport(
    id: string,
    data: Partial<InsertManagementReport>
  ): Promise<ManagementReport | undefined> {
    const [updated] = await db
      .update(managementReports)
      .set({
        ...data,
        updatedAt: sql`NOW()`,
      })
      .where(eq(managementReports.id, id))
      .returning();

    return updated;
  }

  async deleteManagementReport(id: string, userId?: string): Promise<boolean> {
    await db
      .update(managementReports)
      .set({
        deletedAt: sql`NOW()`,
        deletedById: userId,
      })
      .where(eq(managementReports.id, id));

    return true;
  }

  async generateManagementReportData(periodStart: string, periodEnd: string): Promise<ManagementReportData> {
    // Метрики продаж ОПТ
    const [optMetrics] = await db
      .select({
        totalVolumeTonnes: sql<string>`COALESCE(SUM(${optMassTonnesSql()}), 0)::text`,
        totalRevenue: sql<string>`COALESCE(SUM(CAST(${opt.saleAmount} AS NUMERIC)), 0)`,
        totalProfit: sql<string>`COALESCE(SUM(CAST(${opt.profit} AS NUMERIC)), 0)`,
      })
      .from(opt)
      .where(
        and(
          gte(opt.dealDate, periodStart),
          lte(opt.dealDate, periodEnd),
          isNull(opt.deletedAt)
        )
      );

    const optMarginality = parseFloat(optMetrics?.totalRevenue || "0") > 0
      ? ((parseFloat(optMetrics?.totalProfit || "0") / parseFloat(optMetrics?.totalRevenue || "0")) * 100).toFixed(2)
      : "0";

    // Метрики продаж ЗВС
    const [refuelingMetrics] = await db
      .select({
        totalVolumeTonnes: sql<string>`COALESCE(SUM(COALESCE(
          ${aircraftRefueling.quantityTonnes},
          CAST(${aircraftRefueling.quantityKg} AS NUMERIC) / 1000
        )), 0)::text`,
        totalRevenue: sql<string>`COALESCE(SUM(CAST(${aircraftRefueling.saleAmount} AS NUMERIC)), 0)`,
        totalProfit: sql<string>`COALESCE(SUM(CAST(${aircraftRefueling.profit} AS NUMERIC)), 0)`,
      })
      .from(aircraftRefueling)
      .where(
        and(
          gte(aircraftRefueling.refuelingDate, periodStart),
          lte(aircraftRefueling.refuelingDate, periodEnd),
          isNull(aircraftRefueling.deletedAt)
        )
      );

    const refuelingMarginality = parseFloat(refuelingMetrics?.totalRevenue || "0") > 0
      ? ((parseFloat(refuelingMetrics?.totalProfit || "0") / parseFloat(refuelingMetrics?.totalRevenue || "0")) * 100).toFixed(2)
      : "0";

    // Комбинированные метрики продаж
    const combinedVolume = (
      parseFloat(optMetrics?.totalVolumeTonnes || "0") +
      parseFloat(refuelingMetrics?.totalVolumeTonnes || "0")
    ).toString();

    const combinedRevenue = (
      parseFloat(optMetrics?.totalRevenue || "0") + 
      parseFloat(refuelingMetrics?.totalRevenue || "0")
    ).toString();

    const combinedProfit = (
      parseFloat(optMetrics?.totalProfit || "0") + 
      parseFloat(refuelingMetrics?.totalProfit || "0")
    ).toString();

    const combinedMarginality = parseFloat(combinedRevenue) > 0
      ? ((parseFloat(combinedProfit) / parseFloat(combinedRevenue)) * 100).toFixed(2)
      : "0";

    // Метрики складов
    const [warehouseMetrics] = await db
      .select({
        totalBalanceTonnes: sql<string>`COALESCE(SUM(CAST(${warehouseTransactions.quantityTonnes} AS NUMERIC)), 0)::text`,
        totalValue: sql<string>`COALESCE(SUM(CAST(${warehouseTransactions.quantityTonnes} AS NUMERIC) * CAST(${warehouseTransactions.pricePerTonne} AS NUMERIC)), 0)`,
      })
      .from(warehouseTransactions)
      .where(isNull(warehouseTransactions.deletedAt));

    const [movementsCount] = await db
      .select({
        count: sql<number>`CAST(COUNT(*) AS INTEGER)`,
      })
      .from(movement)
      .where(
        and(
          gte(movement.movementDate, periodStart),
          lte(movement.movementDate, periodEnd),
          isNull(movement.deletedAt)
        )
      );

    const [exchangesCount] = await db
      .select({
        count: sql<number>`CAST(COUNT(*) AS INTEGER)`,
      })
      .from(exchangeDeals)
      .where(
        and(
          gte(exchangeDeals.dealDate, periodStart),
          lte(exchangeDeals.dealDate, periodEnd),
          isNull(exchangeDeals.deletedAt)
        )
      );

    // Финансовые метрики
    const [cashflowMetrics] = await db
      .select({
        totalIncome: sql<string>`COALESCE(SUM(CASE WHEN ${cashflowTransactions.category} = 'income' THEN CAST(${cashflowTransactions.amount} AS NUMERIC) ELSE 0 END), 0)`,
        totalExpense: sql<string>`COALESCE(SUM(CASE WHEN ${cashflowTransactions.category} = 'expense' THEN CAST(${cashflowTransactions.amount} AS NUMERIC) ELSE 0 END), 0)`,
      })
      .from(cashflowTransactions)
      .where(
        and(
          sql`${cashflowTransactions.transactionDate} >= ${periodStart}`,
          sql`${cashflowTransactions.transactionDate} <= ${periodEnd}`,
          isNull(cashflowTransactions.deletedAt)
        )
      );

    const netProfit = (
      parseFloat(cashflowMetrics?.totalIncome || "0") - 
      parseFloat(cashflowMetrics?.totalExpense || "0")
    ).toString();

    const [paymentsCount] = await db
      .select({
        count: sql<number>`CAST(COUNT(*) AS INTEGER)`,
      })
      .from(cashflowTransactions)
      .where(
        and(
          sql`${cashflowTransactions.transactionDate} >= ${periodStart}`,
          sql`${cashflowTransactions.transactionDate} <= ${periodEnd}`,
          isNull(cashflowTransactions.deletedAt)
        )
      );

    // Метрики госконтрактов
    const [govContractsMetrics] = await db
      .select({
        activeCount: sql<number>`CAST(COUNT(*) AS INTEGER)`,
        totalValue: sql<string>`COALESCE(SUM(COALESCE(CAST(NULLIF(${governmentContracts.totalAmount}, '') AS NUMERIC), 0)), 0)::text`,
        completedAmount: sql<string>`COALESCE(SUM(COALESCE(CAST(NULLIF(${governmentContracts.currentAmount}, '') AS NUMERIC), 0)), 0)::text`,
        remainingAmount: sql<string>`COALESCE(SUM(GREATEST(
          COALESCE(CAST(NULLIF(${governmentContracts.totalAmount}, '') AS NUMERIC), 0) -
          COALESCE(CAST(NULLIF(${governmentContracts.currentAmount}, '') AS NUMERIC), 0),
          0
        )), 0)::text`,
        plannedVolumeTonnes: sql<string>`COALESCE(SUM(COALESCE(CAST(NULLIF(${governmentContracts.plannedVolume}, '') AS NUMERIC), 0) / 1000), 0)::text`,
        actualVolumeTonnes: sql<string>`COALESCE(SUM(COALESCE(CAST(NULLIF(${governmentContracts.actualVolume}, '') AS NUMERIC), 0) / 1000), 0)::text`,
        remainingVolumeTonnes: sql<string>`COALESCE(SUM(GREATEST(
          COALESCE(CAST(NULLIF(${governmentContracts.plannedVolume}, '') AS NUMERIC), 0) -
          COALESCE(CAST(NULLIF(${governmentContracts.actualVolume}, '') AS NUMERIC), 0),
          0
        ) / 1000), 0)::text`,
      })
      .from(governmentContracts)
      .where(
        and(
          eq(governmentContracts.status, "active"),
          isNull(governmentContracts.deletedAt)
        )
      );

    // Метрики логистики (на основе настроенных тарифов)
    const [logisticsMetrics] = await db
      .select({
        totalCount: sql<number>`CAST(COUNT(*) AS INTEGER)`,
        totalDistance: sql<string>`COALESCE(SUM(CAST(${deliveryCost.distance} AS NUMERIC)), 0)`,
      })
      .from(deliveryCost)
      .where(
        and(
          eq(deliveryCost.isActive, true),
          isNull(deliveryCost.deletedAt)
        )
      );

    // TODO: Рассчитать реальную стоимость доставок на основе операций
    const totalCost = "0";

    return {
      salesMetrics: {
        optSales: {
          totalVolumeTonnes: optMetrics?.totalVolumeTonnes || "0",
          totalRevenue: optMetrics?.totalRevenue || "0",
          totalProfit: optMetrics?.totalProfit || "0",
          marginality: optMarginality,
        },
        refuelingSales: {
          totalVolumeTonnes: refuelingMetrics?.totalVolumeTonnes || "0",
          totalRevenue: refuelingMetrics?.totalRevenue || "0",
          totalProfit: refuelingMetrics?.totalProfit || "0",
          marginality: refuelingMarginality,
        },
        combined: {
          totalVolumeTonnes: combinedVolume,
          totalRevenue: combinedRevenue,
          totalProfit: combinedProfit,
          marginality: combinedMarginality,
        },
      },
      warehouseMetrics: {
        totalBalanceTonnes: warehouseMetrics?.totalBalanceTonnes || "0",
        totalValue: warehouseMetrics?.totalValue || "0",
        movementsCount: movementsCount?.count || 0,
        exchangesCount: exchangesCount?.count || 0,
      },
      financialMetrics: {
        totalCashflow: cashflowMetrics?.totalIncome || "0",
        totalExpenses: cashflowMetrics?.totalExpense || "0",
        netProfit: netProfit,
        paymentsCount: paymentsCount?.count || 0,
      },
      govContractsMetrics: {
        activeContracts: govContractsMetrics?.activeCount || 0,
        totalContractValue: govContractsMetrics?.totalValue || "0",
        completedAmount: govContractsMetrics?.completedAmount || "0",
        remainingAmount: govContractsMetrics?.remainingAmount || "0",
        plannedVolumeTonnes: govContractsMetrics?.plannedVolumeTonnes || "0",
        actualVolumeTonnes: govContractsMetrics?.actualVolumeTonnes || "0",
        remainingVolumeTonnes: govContractsMetrics?.remainingVolumeTonnes || "0",
      },
      logisticsMetrics: {
        totalDeliveries: logisticsMetrics?.totalCount || 0,
        totalDeliveryCost: totalCost,
        totalDistance: logisticsMetrics?.totalDistance || "0",
      },
    };
  }
}
