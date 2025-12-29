
import { eq, desc, sql, and, isNull, gte, lte } from "drizzle-orm";
import { db } from "server/db";
import { managementReports, type ManagementReport, type InsertManagementReport } from "@shared/schema";
import { opt } from "../../opt/entities/opt";
import { aircraftRefueling } from "../../refueling/entities/refueling";
import { warehouseTransactions } from "../../warehouses/entities/warehouses";
import { movement } from "../../movement/entities/movement";
import { exchange } from "../../exchange/entities/exchange";
import { cashflowEntries } from "../../finance/entities/finance";
import { governmentContracts } from "../../gov-contracts/entities/gov-contracts";
import { delivery } from "../../delivery/entities/delivery";
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
        totalVolume: sql<string>`COALESCE(SUM(CAST(${opt.quantityKg} AS NUMERIC)), 0)`,
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
        totalVolume: sql<string>`COALESCE(SUM(CAST(${aircraftRefueling.quantityKg} AS NUMERIC)), 0)`,
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
      parseFloat(optMetrics?.totalVolume || "0") + 
      parseFloat(refuelingMetrics?.totalVolume || "0")
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
        totalBalance: sql<string>`COALESCE(SUM(CAST(${warehouseTransactions.balanceKg} AS NUMERIC)), 0)`,
        totalValue: sql<string>`COALESCE(SUM(CAST(${warehouseTransactions.balanceKg} AS NUMERIC) * CAST(${warehouseTransactions.purchasePrice} AS NUMERIC)), 0)`,
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
      .from(exchange)
      .where(
        and(
          gte(exchange.exchangeDate, periodStart),
          lte(exchange.exchangeDate, periodEnd),
          isNull(exchange.deletedAt)
        )
      );

    // Финансовые метрики
    const [cashflowMetrics] = await db
      .select({
        totalIncome: sql<string>`COALESCE(SUM(CASE WHEN ${cashflowEntries.transactionType} = 'income' THEN CAST(${cashflowEntries.amount} AS NUMERIC) ELSE 0 END), 0)`,
        totalExpense: sql<string>`COALESCE(SUM(CASE WHEN ${cashflowEntries.transactionType} = 'expense' THEN CAST(${cashflowEntries.amount} AS NUMERIC) ELSE 0 END), 0)`,
      })
      .from(cashflowEntries)
      .where(
        and(
          gte(cashflowEntries.transactionDate, periodStart),
          lte(cashflowEntries.transactionDate, periodEnd),
          isNull(cashflowEntries.deletedAt)
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
      .from(cashflowEntries)
      .where(
        and(
          gte(cashflowEntries.transactionDate, periodStart),
          lte(cashflowEntries.transactionDate, periodEnd),
          isNull(cashflowEntries.deletedAt)
        )
      );

    // Метрики госконтрактов
    const [govContractsMetrics] = await db
      .select({
        activeCount: sql<number>`CAST(COUNT(*) AS INTEGER)`,
        totalValue: sql<string>`COALESCE(SUM(CAST(${governmentContracts.totalAmount} AS NUMERIC)), 0)`,
        completedVolume: sql<string>`COALESCE(SUM(CAST(${governmentContracts.actualVolume} AS NUMERIC)), 0)`,
      })
      .from(governmentContracts)
      .where(
        and(
          eq(governmentContracts.status, "active"),
          isNull(governmentContracts.deletedAt)
        )
      );

    const remainingVolume = (
      parseFloat(govContractsMetrics?.totalValue || "0") - 
      parseFloat(govContractsMetrics?.completedVolume || "0")
    ).toString();

    // Метрики логистики
    const [logisticsMetrics] = await db
      .select({
        totalCount: sql<number>`CAST(COUNT(*) AS INTEGER)`,
        totalCost: sql<string>`COALESCE(SUM(CAST(${delivery.cost} AS NUMERIC)), 0)`,
        totalDistance: sql<string>`COALESCE(SUM(CAST(${delivery.distance} AS NUMERIC)), 0)`,
      })
      .from(delivery)
      .where(
        and(
          gte(delivery.deliveryDate, periodStart),
          lte(delivery.deliveryDate, periodEnd),
          isNull(delivery.deletedAt)
        )
      );

    return {
      salesMetrics: {
        optSales: {
          totalVolume: optMetrics?.totalVolume || "0",
          totalRevenue: optMetrics?.totalRevenue || "0",
          totalProfit: optMetrics?.totalProfit || "0",
          marginality: optMarginality,
        },
        refuelingSales: {
          totalVolume: refuelingMetrics?.totalVolume || "0",
          totalRevenue: refuelingMetrics?.totalRevenue || "0",
          totalProfit: refuelingMetrics?.totalProfit || "0",
          marginality: refuelingMarginality,
        },
        combined: {
          totalVolume: combinedVolume,
          totalRevenue: combinedRevenue,
          totalProfit: combinedProfit,
          marginality: combinedMarginality,
        },
      },
      warehouseMetrics: {
        totalBalance: warehouseMetrics?.totalBalance || "0",
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
        completedVolume: govContractsMetrics?.completedVolume || "0",
        remainingVolume: remainingVolume,
      },
      logisticsMetrics: {
        totalDeliveries: logisticsMetrics?.totalCount || 0,
        totalDeliveryCost: logisticsMetrics?.totalCost || "0",
        totalDistance: logisticsMetrics?.totalDistance || "0",
      },
    };
  }
}
