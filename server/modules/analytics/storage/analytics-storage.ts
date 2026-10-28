
import { eq, desc, sql, and, isNull, gte, lte, between } from "drizzle-orm";
import { db } from "server/db";
import { opt, aircraftRefueling, savedReports, suppliers, customers, warehouseTransactions } from "@shared/schema";
import { IAnalyticsStorage, AnalyticsData, AnalyticsSummary } from "./types";
import type { SavedReport } from "../../reports/storage/types";
import { legacyDealMassToTonnes } from "@shared/units";

const dealMassTonnes = (deal: {
  quantityKg: string | null;
  quantityLiters: string | null;
  density: string | null;
}) =>
  legacyDealMassToTonnes(deal.quantityKg, deal.quantityLiters, deal.density) ?? 0;

function legacyDealMassKilogramsSql(
  quantityKg: unknown,
  quantityLiters: unknown,
  density: unknown,
) {
  return sql`
    CASE
      WHEN CAST(COALESCE(${quantityLiters}, '0') AS NUMERIC) > 0
        AND CAST(COALESCE(${density}, '0') AS NUMERIC) > 0
      THEN CAST(${quantityLiters} AS NUMERIC) * CAST(${density} AS NUMERIC)
      ELSE CAST(${quantityKg} AS NUMERIC)
    END
  `;
}

export class AnalyticsStorage implements IAnalyticsStorage {
  async getAnalyticsData(
    startDate: string,
    endDate: string,
    module: string,
    groupBy: 'day' | 'week' | 'month'
  ): Promise<AnalyticsData> {
    // Implementation will aggregate data based on module and groupBy parameter
    // This is a placeholder for now
    return {
      labels: [],
      datasets: [],
    };
  }

  async getAnalyticsSummary(
    startDate: string,
    endDate: string,
    module: string
  ): Promise<AnalyticsSummary> {
    if (module === 'opt') {
      return this.getOptAnalyticsSummary(startDate, endDate);
    } else if (module === 'refueling') {
      return this.getRefuelingAnalyticsSummary(startDate, endDate);
    }

    // Default empty summary
    return {
      totalRevenue: 0,
      totalProfit: 0,
      totalVolumeTonnes: 0,
      averageMargin: 0,
      topSuppliers: [],
      topBuyers: [],
      productTypeDistribution: [],
    };
  }

  private async getOptAnalyticsSummary(
    startDate: string,
    endDate: string
  ): Promise<AnalyticsSummary> {
    const deals = await db.query.opt.findMany({
      where: and(
        gte(opt.dealDate, startDate),
        lte(opt.dealDate, endDate),
        isNull(opt.deletedAt)
      ),
      with: {
        supplier: true,
        buyer: true,
      },
    });

    const totalRevenue = deals.reduce((sum, deal) => sum + parseFloat(deal.saleAmount || '0'), 0);
    const totalProfit = deals.reduce((sum, deal) => sum + parseFloat(deal.profit || '0'), 0);
    const totalVolumeTonnes = deals.reduce((sum, deal) => sum + dealMassTonnes(deal), 0);
    const averageMargin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;

    // Group by suppliers
    const supplierMap = new Map<string, { name: string; volumeTonnes: number; revenue: number }>();
    deals.forEach(deal => {
      const supplierId = deal.supplierId;
      const supplierName = deal.supplier?.name || 'Неизвестно';
      const existing = supplierMap.get(supplierId) || { name: supplierName, volumeTonnes: 0, revenue: 0 };
      existing.volumeTonnes += dealMassTonnes(deal);
      existing.revenue += parseFloat(deal.saleAmount || '0');
      supplierMap.set(supplierId, existing);
    });

    // Group by buyers
    const buyerMap = new Map<string, { name: string; volumeTonnes: number; revenue: number }>();
    deals.forEach(deal => {
      const buyerId = deal.buyerId;
      const buyerName = deal.buyer?.name || 'Неизвестно';
      const existing = buyerMap.get(buyerId) || { name: buyerName, volumeTonnes: 0, revenue: 0 };
      existing.volumeTonnes += dealMassTonnes(deal);
      existing.revenue += parseFloat(deal.saleAmount || '0');
      buyerMap.set(buyerId, existing);
    });

    const topSuppliers = Array.from(supplierMap.values())
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);

    const topBuyers = Array.from(buyerMap.values())
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);

    return {
      totalRevenue,
      totalProfit,
      totalVolumeTonnes,
      averageMargin,
      topSuppliers,
      topBuyers,
      productTypeDistribution: [],
    };
  }

  private async getRefuelingAnalyticsSummary(
    startDate: string,
    endDate: string
  ): Promise<AnalyticsSummary> {
    const operations = await db.query.aircraftRefueling.findMany({
      where: and(
        gte(aircraftRefueling.refuelingDate, startDate),
        lte(aircraftRefueling.refuelingDate, endDate),
        isNull(aircraftRefueling.deletedAt)
      ),
      with: {
        supplier: true,
        buyer: true,
      },
    });

    const totalRevenue = operations.reduce((sum, op) => sum + parseFloat(op.saleAmount || '0'), 0);
    const totalProfit = operations.reduce((sum, op) => sum + parseFloat(op.profit || '0'), 0);
    const totalVolumeTonnes = operations.reduce((sum, op) => sum + dealMassTonnes(op), 0);
    const averageMargin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;

    // Product type distribution
    const productTypeMap = new Map<string, number>();
    operations.forEach(op => {
      const existing = productTypeMap.get(op.productType) || 0;
      productTypeMap.set(op.productType, existing + dealMassTonnes(op));
    });

    const productTypeDistribution = Array.from(productTypeMap.entries()).map(([type, volume]) => ({
      type,
      volumeTonnes: volume,
      percentage: totalVolumeTonnes > 0 ? (volume / totalVolumeTonnes) * 100 : 0,
    }));

    return {
      totalRevenue,
      totalProfit,
      totalVolumeTonnes,
      averageMargin,
      topSuppliers: [],
      topBuyers: [],
      productTypeDistribution,
    };
  }

  async getComparativeAnalysis(
    periods: Array<{ startDate: string; endDate: string; label: string }>,
    metrics: string[]
  ): Promise<any> {
    const comparativeData: any = {};

    for (const period of periods) {
      const periodData: any = {};

      if (metrics.includes('sales')) {
        const [optSales] = await db
          .select({
            optVolumeTonnes: sql<string>`COALESCE(SUM(${legacyDealMassKilogramsSql(opt.quantityKg, opt.quantityLiters, opt.density)}) / 1000, 0)::text`,
            optRevenue: sql<string>`COALESCE(SUM(CAST(${opt.saleAmount} AS NUMERIC)), 0)`,
          })
          .from(opt)
          .where(
            and(
              gte(opt.dealDate, period.startDate),
              lte(opt.dealDate, period.endDate),
              isNull(opt.deletedAt)
            )
          );

        const [refuelingSales] = await db
          .select({
            refuelingVolumeTonnes: sql<string>`COALESCE(SUM(${legacyDealMassKilogramsSql(aircraftRefueling.quantityKg, aircraftRefueling.quantityLiters, aircraftRefueling.density)}) / 1000, 0)::text`,
            refuelingRevenue: sql<string>`COALESCE(SUM(CAST(${aircraftRefueling.saleAmount} AS NUMERIC)), 0)`,
          })
          .from(aircraftRefueling)
          .where(
            and(
              gte(aircraftRefueling.refuelingDate, period.startDate),
              lte(aircraftRefueling.refuelingDate, period.endDate),
              isNull(aircraftRefueling.deletedAt),
            ),
          );

        periodData.sales = { ...optSales, ...refuelingSales };
      }

      if (metrics.includes('profit')) {
        const [optProfit] = await db
          .select({
            optProfit: sql<string>`COALESCE(SUM(CAST(${opt.profit} AS NUMERIC)), 0)`,
          })
          .from(opt)
          .where(
            and(
              gte(opt.dealDate, period.startDate),
              lte(opt.dealDate, period.endDate),
              isNull(opt.deletedAt)
            )
          );

        const [refuelingProfit] = await db
          .select({
            refuelingProfit: sql<string>`COALESCE(SUM(CAST(${aircraftRefueling.profit} AS NUMERIC)), 0)`,
          })
          .from(aircraftRefueling)
          .where(
            and(
              gte(aircraftRefueling.refuelingDate, period.startDate),
              lte(aircraftRefueling.refuelingDate, period.endDate),
              isNull(aircraftRefueling.deletedAt),
            ),
          );

        periodData.profit = { ...optProfit, ...refuelingProfit };
      }

      if (metrics.includes('warehouse')) {
        const [warehouseData] = await db
          .select({
            totalBalanceTonnes: sql<string>`COALESCE(SUM(COALESCE(CAST(${warehouseTransactions.quantityTonnes} AS NUMERIC), CAST(${warehouseTransactions.quantity} AS NUMERIC) / 1000)), 0)::text`,
          })
          .from(warehouseTransactions)
          .where(isNull(warehouseTransactions.deletedAt));

        periodData.warehouse = warehouseData;
      }

      comparativeData[period.label] = periodData;
    }

    return comparativeData;
  }

  async getSavedAnalytics(userId: string): Promise<SavedReport[]> {
    return db.query.savedReports.findMany({
      where: and(
        eq(savedReports.reportType, 'analytics'),
        isNull(savedReports.deletedAt)
      ),
      orderBy: [desc(savedReports.createdAt)],
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
}
