
import type { InferSelectModel, InferInsertModel } from "drizzle-orm";
import type { savedReports } from "../entities/reports";

export type SavedReport = InferSelectModel<typeof savedReports>;
export type InsertSavedReport = InferInsertModel<typeof savedReports>;

export interface IReportsStorage {
  getReport(id: string): Promise<Report | undefined>;
  getReports(): Promise<Report[]>;
  createReport(data: InsertSavedReport): Promise<Report>;
  updateReport(id: string, data: Partial<InsertSavedReport>): Promise<Report | undefined>;
  deleteReport(id: string, userId?: string): Promise<boolean>;
  generateCustomPeriodReport(startDate: string, endDate: string, reportTypes: string[]): Promise<any>;
}
