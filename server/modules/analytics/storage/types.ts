
import type { SavedReport } from "../../reports/storage/types";

export interface AnalyticsData {
  labels: string[];
  datasets: Array<{
    label: string;
    data: number[];
    backgroundColor?: string;
    borderColor?: string;
  }>;
}

export interface AnalyticsSummary {
  totalRevenue: number;
  totalProfit: number;
  totalVolume: number;
  averageMargin: number;
  topSuppliers: Array<{ name: string; volume: number; revenue: number }>;
  topBuyers: Array<{ name: string; volume: number; revenue: number }>;
  productTypeDistribution: Array<{ type: string; volume: number; percentage: number }>;
}

export interface IAnalyticsStorage {
  getAnalyticsData(
    startDate: string,
    endDate: string,
    module: string,
    groupBy: 'day' | 'week' | 'month'
  ): Promise<AnalyticsData>;
  
  getAnalyticsSummary(
    startDate: string,
    endDate: string,
    module: string
  ): Promise<AnalyticsSummary>;
  
  getSavedAnalytics(userId: string): Promise<SavedReport[]>;
}
