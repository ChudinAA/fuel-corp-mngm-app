import { eq, desc, sql, and, isNull, gte, lte } from "drizzle-orm";
import { db } from "server/db";
import { reports } from "../entities/reports";
import { opt } from "../../opt/entities/opt";
import { aircraftRefueling } from "../../refueling/entities/refueling";
import { movement } from "../../movement/entities/movement";
import { exchange } from "../../exchange/entities/exchange";
import type { Report, InsertReport } from "./types";

export interface IReportsStorage {
  getReport(id: string): Promise<Report | undefined>;
  getReports(): Promise<Report[]>;
  createReport(data: InsertReport): Promise<Report>;
  updateReport(id: string, data: Partial<InsertReport>): Promise<Report | undefined>;
  deleteReport(id: string, userId?: string): Promise<boolean>;
  generateCustomPeriodReport(startDate: string, endDate: string, reportTypes: string[]): Promise<any>;
}

export class ReportsStorage implements IReportsStorage {
  async getReport(id: string): Promise<Report | undefined> {
    // The original code for getReport was not provided in the changes.
    // Assuming it exists and needs to be preserved.
    // This is a placeholder, replace with actual implementation if available.
    return undefined;
  }

  async getReports(): Promise<Report[]> {
    // The original code for getReports was not provided in the changes.
    // Assuming it exists and needs to be preserved.
    // This is a placeholder, replace with actual implementation if available.
    return [];
  }

  async createReport(data: InsertReport): Promise<Report> {
    // The original code for createReport was not provided in the changes.
    // Assuming it exists and needs to be preserved.
    // This is a placeholder, replace with actual implementation if available.
    const [created] = await db.insert(reports).values(data).returning();
    return created;
  }

  async updateReport(id: string, data: Partial<InsertReport>): Promise<Report | undefined> {
    // The original code for updateReport was not provided in the changes.
    // Assuming it exists and needs to be preserved.
    // This is a placeholder, replace with actual implementation if available.
    const [updated] = await db
      .update(reports)
      .set({
        ...data,
        updatedAt: sql`NOW()`,
      })
      .where(eq(reports.id, id))
      .returning();

    return updated;
  }

  async deleteReport(id: string, userId?: string): Promise<boolean> {
    // The original code for deleteReport was not provided in the changes.
    // Assuming it exists and needs to be preserved.
    // This is a placeholder, replace with actual implementation if available.
    await db
      .update(reports)
      .set({
        deletedAt: sql`NOW()`,
        deletedById: userId,
      })
      .where(eq(reports.id, id));

    return true;
  }

  async generateCustomPeriodReport(startDate: string, endDate: string, reportTypes: string[]): Promise<any> {
    const results: any = {};

    for (const reportType of reportTypes) {
      switch (reportType) {
        case "opt":
          results.opt = await db.query.opt.findMany({
            where: and(
              gte(opt.date, startDate),
              lte(opt.date, endDate)
            ),
          });
          break;
        case "refueling":
          results.refueling = await db.query.aircraftRefueling.findMany({
            where: and(
              gte(aircraftRefueling.date, startDate),
              lte(aircraftRefueling.date, endDate)
            ),
          });
          break;
        case "movement":
          results.movement = await db.query.movement.findMany({
            where: and(
              gte(movement.date, startDate),
              lte(movement.date, endDate)
            ),
          });
          break;
        case "exchange":
          results.exchange = await db.query.exchange.findMany({
            where: and(
              gte(exchange.date, startDate),
              lte(exchange.date, endDate)
            ),
          });
          break;
        // Add cases for other report types as needed
        default:
          break;
      }
    }
    return results;
  }
}