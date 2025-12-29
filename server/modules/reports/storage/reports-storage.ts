
import { eq, desc, sql, and, isNull, gte, lte } from "drizzle-orm";
import { db } from "server/db";
import { savedReports } from "../entities/reports";
import { opt } from "../../opt/entities/opt";
import { aircraftRefueling } from "../../refueling/entities/refueling";
import { movement } from "../../movement/entities/movement";
import { exchange } from "../../exchange/entities/exchange";
import type { SavedReport, InsertSavedReport, IReportsStorage } from "./types";

export class ReportsStorage implements IReportsStorage {
  async getSavedReport(id: string): Promise<SavedReport | undefined> {
    return db.query.savedReports.findFirst({
      where: and(eq(savedReports.id, id), isNull(savedReports.deletedAt)),
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

  async getSavedReports(userId: string, reportType?: string): Promise<SavedReport[]> {
    const conditions = [isNull(savedReports.deletedAt)];
    
    // Показываем пользователю его отчеты или публичные отчеты
    conditions.push(
      sql`(${savedReports.createdById} = ${userId} OR ${savedReports.isPublic} = 'true')`
    );
    
    if (reportType) {
      conditions.push(eq(savedReports.reportType, reportType));
    }

    return db.query.savedReports.findMany({
      where: and(...conditions),
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

  async createSavedReport(data: InsertSavedReport): Promise<SavedReport> {
    const [created] = await db.insert(savedReports).values(data).returning();
    return created;
  }

  async updateSavedReport(id: string, data: Partial<InsertSavedReport>): Promise<SavedReport | undefined> {
    const [updated] = await db
      .update(savedReports)
      .set({
        ...data,
        updatedAt: sql`NOW()`,
      })
      .where(eq(savedReports.id, id))
      .returning();

    return updated;
  }

  async deleteSavedReport(id: string, userId?: string): Promise<boolean> {
    await db
      .update(savedReports)
      .set({
        deletedAt: sql`NOW()`,
        deletedById: userId,
      })
      .where(eq(savedReports.id, id));

    return true;
  }

  async generateCustomPeriodReport(startDate: string, endDate: string, reportTypes: string[]): Promise<any> {
    const results: any = {};

    for (const reportType of reportTypes) {
      switch (reportType) {
        case "opt":
          results.opt = await db.query.opt.findMany({
            where: and(
              gte(opt.dealDate, startDate),
              lte(opt.dealDate, endDate),
              isNull(opt.deletedAt)
            ),
            with: {
              customer: true,
              base: true,
              warehouse: true,
            },
          });
          break;
        case "refueling":
          results.refueling = await db.query.aircraftRefueling.findMany({
            where: and(
              gte(aircraftRefueling.refuelingDate, startDate),
              lte(aircraftRefueling.refuelingDate, endDate),
              isNull(aircraftRefueling.deletedAt)
            ),
            with: {
              base: true,
              warehouse: true,
            },
          });
          break;
        case "movement":
          results.movement = await db.query.movement.findMany({
            where: and(
              gte(movement.movementDate, startDate),
              lte(movement.movementDate, endDate),
              isNull(movement.deletedAt)
            ),
            with: {
              sourceWarehouse: true,
              destinationWarehouse: true,
              carrier: true,
            },
          });
          break;
        case "exchange":
          results.exchange = await db.query.exchange.findMany({
            where: and(
              gte(exchange.exchangeDate, startDate),
              lte(exchange.exchangeDate, endDate),
              isNull(exchange.deletedAt)
            ),
            with: {
              sourceWarehouse: true,
              destinationWarehouse: true,
            },
          });
          break;
        default:
          break;
      }
    }
    return results;
  }
}
