
import type { InferSelectModel, InferInsertModel } from "drizzle-orm";
import type { savedReports } from "../entities/reports";

export type SavedReport = InferSelectModel<typeof savedReports>;
export type InsertSavedReport = InferInsertModel<typeof savedReports>;

export interface DailyOptReportDeal {
  id: string;
  dealDate: string;
  supplier: { name: string } | null;
  buyer: { name: string } | null;
  basis: string | null;
  quantityTonnes: number;
  purchaseAmount: string | null;
  saleAmount: string | null;
  profit: string | null;
}

export interface IReportsStorage {
  getSavedReport(id: string): Promise<SavedReport | undefined>;
  getSavedReports(userId: string, reportType?: string): Promise<SavedReport[]>;
  createSavedReport(data: InsertSavedReport): Promise<SavedReport>;
  updateSavedReport(id: string, data: Partial<InsertSavedReport>): Promise<SavedReport | undefined>;
  deleteSavedReport(id: string, userId?: string): Promise<boolean>;
  getDailyOptDeals(date: string): Promise<DailyOptReportDeal[]>;
  generateCustomPeriodReport(startDate: string, endDate: string, reportTypes: string[]): Promise<any>;
}
