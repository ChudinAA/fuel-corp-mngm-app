
import type { InferSelectModel, InferInsertModel } from "drizzle-orm";
import type { managementReports } from "../entities/management-report";

export type ManagementReport = InferSelectModel<typeof managementReports>;
export type InsertManagementReport = InferInsertModel<typeof managementReports>;

export interface ManagementReportData {
  // Продажи
  salesMetrics: {
    optSales: {
      totalVolumeTonnes: string;
      totalRevenue: string;
      totalProfit: string;
      marginality: string;
    };
    refuelingSales: {
      totalVolumeTonnes: string;
      totalRevenue: string;
      totalProfit: string;
      marginality: string;
    };
    combined: {
      totalVolumeTonnes: string;
      totalRevenue: string;
      totalProfit: string;
      marginality: string;
    };
  };
  
  // Складские операции
  warehouseMetrics: {
    totalBalanceTonnes: string;
    totalValue: string;
    movementsCount: number;
    exchangesCount: number;
  };
  
  // Финансы
  financialMetrics: {
    totalCashflow: string;
    totalExpenses: string;
    netProfit: string;
    paymentsCount: number;
  };
  
  // Государственные контракты
  govContractsMetrics: {
    activeContracts: number;
    totalContractValue: string;
    completedAmount: string;
    remainingAmount: string;
    plannedVolumeTonnes: string;
    actualVolumeTonnes: string;
    remainingVolumeTonnes: string;
  };
  
  // Логистика
  logisticsMetrics: {
    totalDeliveries: number;
    totalDeliveryCost: string;
    totalDistance: string;
  };
}

export interface IManagementReportStorage {
  getManagementReport(id: string): Promise<ManagementReport | undefined>;
  getManagementReports(filters?: {
    startDate?: string;
    endDate?: string;
  }): Promise<ManagementReport[]>;
  createManagementReport(data: InsertManagementReport): Promise<ManagementReport>;
  updateManagementReport(id: string, data: Partial<InsertManagementReport>): Promise<ManagementReport | undefined>;
  deleteManagementReport(id: string, userId?: string): Promise<boolean>;
  generateManagementReportData(periodStart: string, periodEnd: string): Promise<ManagementReportData>;
}
