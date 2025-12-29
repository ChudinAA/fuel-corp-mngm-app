
import { eq, desc, sql, and, isNull, gte, lte, between } from "drizzle-orm";
import { db } from "server/db";
import { opt, aircraftRefueling, savedReports, suppliers, customers } from "@shared/schema";
import { IAnalyticsStorage, AnalyticsData, AnalyticsSummary } from "./types";
import type { SavedReport } from "../../reports/storage/types";

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
      totalVolume: 0,
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
    const totalVolume = deals.reduce((sum, deal) => sum + parseFloat(deal.quantityKg || '0'), 0);
    const averageMargin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;

    // Group by suppliers
    const supplierMap = new Map<string, { name: string; volume: number; revenue: number }>();
    deals.forEach(deal => {
      const supplierId = deal.supplierId;
      const supplierName = deal.supplier?.name || 'Неизвестно';
      const existing = supplierMap.get(supplierId) || { name: supplierName, volume: 0, revenue: 0 };
      existing.volume += parseFloat(deal.quantityKg || '0');
      existing.revenue += parseFloat(deal.saleAmount || '0');
      supplierMap.set(supplierId, existing);
    });

    // Group by buyers
    const buyerMap = new Map<string, { name: string; volume: number; revenue: number }>();
    deals.forEach(deal => {
      const buyerId = deal.buyerId;
      const buyerName = deal.buyer?.name || 'Неизвестно';
      const existing = buyerMap.get(buyerId) || { name: buyerName, volume: 0, revenue: 0 };
      existing.volume += parseFloat(deal.quantityKg || '0');
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
      totalVolume,
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
    const totalVolume = operations.reduce((sum, op) => sum + parseFloat(op.quantityKg || '0'), 0);
    const averageMargin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;

    // Product type distribution
    const productTypeMap = new Map<string, number>();
    operations.forEach(op => {
      const existing = productTypeMap.get(op.productType) || 0;
      productTypeMap.set(op.productType, existing + parseFloat(op.quantityKg || '0'));
    });

    const productTypeDistribution = Array.from(productTypeMap.entries()).map(([type, volume]) => ({
      type,
      volume,
      percentage: totalVolume > 0 ? (volume / totalVolume) * 100 : 0,
    }));

    return {
      totalRevenue,
      totalProfit,
      totalVolume,
      averageMargin,
      topSuppliers: [],
      topBuyers: [],
      productTypeDistribution,


  async getComparativeAnalysis(
    periods: Array<{ startDate: string; endDate: string; label: string }>,
    metrics: string[]
  ): Promise<any> {
    const comparativeData: any = {};

    for (const period of periods) {
      const periodData: any = {};

      if (metrics.includes('sales')) {
        const [salesData] = await db
          .select({
            optVolume: sql<string>`COALESCE(SUM(CAST(${opt.quantityKg} AS NUMERIC)), 0)`,
            optRevenue: sql<string>`COALESCE(SUM(CAST(${opt.saleAmount} AS NUMERIC)), 0)`,
            refuelingVolume: sql<string>`COALESCE(SUM(CAST(${aircraftRefueling.quantityKg} AS NUMERIC)), 0)`,
            refuelingRevenue: sql<string>`COALESCE(SUM(CAST(${aircraftRefueling.saleAmount} AS NUMERIC)), 0)`,
          })
          .from(opt)
          .leftJoin(aircraftRefueling, sql`1=1`)
          .where(
            and(
              gte(opt.dealDate, period.startDate),
              lte(opt.dealDate, period.endDate),
              isNull(opt.deletedAt)
            )
          );

        periodData.sales = salesData;
      }

      if (metrics.includes('profit')) {
        const [profitData] = await db
          .select({
            optProfit: sql<string>`COALESCE(SUM(CAST(${opt.profit} AS NUMERIC)), 0)`,
            refuelingProfit: sql<string>`COALESCE(SUM(CAST(${aircraftRefueling.profit} AS NUMERIC)), 0)`,
          })
          .from(opt)
          .leftJoin(aircraftRefueling, sql`1=1`)
          .where(
            and(
              gte(opt.dealDate, period.startDate),
              lte(opt.dealDate, period.endDate),
              isNull(opt.deletedAt)
            )
          );

        periodData.profit = profitData;
      }

      if (metrics.includes('warehouse')) {
        const [warehouseData] = await db
          .select({
            totalBalance: sql<string>`COALESCE(SUM(CAST(${warehouseTransactions.balanceKg} AS NUMERIC)), 0)`,
          })
          .from(warehouseTransactions)
          .where(isNull(warehouseTransactions.deletedAt));

        periodData.warehouse = warehouseData;
      }

      comparativeData[period.label] = periodData;
    }

    return comparativeData;
  }

    };
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
