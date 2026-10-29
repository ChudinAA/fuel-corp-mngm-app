
import { eq, desc, sql, and, isNull, gte, lte } from "drizzle-orm";
import { db } from "server/db";
import { savedReports } from "../entities/reports";
import { opt } from "../../opt/entities/opt";
import { aircraftRefueling } from "../../refueling/entities/refueling";
import { movement } from "../../movement/entities/movement";
import { exchangeDeals } from "../../exchange-deals/entities/exchange-deals";
import type { SavedReport, InsertSavedReport, IReportsStorage } from "./types";

function dealWithTonnes<T extends {
  quantityTonnes: number | string | null;
}>(deal: T) {
  const quantityTonnes = Number(deal.quantityTonnes);
  if (!Number.isFinite(quantityTonnes)) {
    throw new TypeError("Report deal mass must be available in tonnes");
  }
  return { ...deal, quantityTonnes };
}

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

  async getDailyOptDeals(date: string) {
    const deals = await db.query.opt.findMany({
      where: and(
        sql`${opt.dealDate}::date = ${date}::date`,
        isNull(opt.deletedAt),
      ),
      with: {
        supplier: { columns: { name: true } },
        buyer: { columns: { name: true } },
      },
      orderBy: [desc(opt.dealDate)],
    });

    return deals.map((deal) => ({
      id: deal.id,
      dealDate: deal.dealDate,
      supplier: deal.supplier ? { name: deal.supplier.name } : null,
      buyer: deal.buyer ? { name: deal.buyer.name } : null,
      basis: deal.basis,
      quantityTonnes: Number(deal.quantityTonnes ?? 0),
      purchaseAmount: deal.purchaseAmount,
      saleAmount: deal.saleAmount,
      profit: deal.profit,
    }));
  }

  async generateCustomPeriodReport(startDate: string, endDate: string, reportTypes: string[]): Promise<any> {
    const results: any = {};

    for (const reportType of reportTypes) {
      switch (reportType) {
        case "opt":
          results.opt = (
            await db.query.opt.findMany({
              where: and(
                gte(opt.dealDate, startDate),
                lte(opt.dealDate, endDate),
                isNull(opt.deletedAt),
              ),
              with: {
                buyer: true,
                basis: true,
                warehouse: true,
              },
            })
          ).map(dealWithTonnes);
          break;
        case "refueling":
          results.refueling = (
            await db.query.aircraftRefueling.findMany({
              where: and(
                gte(aircraftRefueling.refuelingDate, startDate),
                lte(aircraftRefueling.refuelingDate, endDate),
                isNull(aircraftRefueling.deletedAt),
              ),
              with: {
                basis: true,
                warehouse: true,
              },
            })
          ).map(dealWithTonnes);
          break;
        case "movement":
          results.movement = (
            await db.query.movement.findMany({
              where: and(
                gte(movement.movementDate, startDate),
                lte(movement.movementDate, endDate),
                isNull(movement.deletedAt),
              ),
              with: {
                fromWarehouse: true,
                toWarehouse: true,
                carrier: true,
              },
            })
          ).map(dealWithTonnes);
          break;
        case "exchange":
          results.exchange = await db.query.exchangeDeals.findMany({
            where: and(
              gte(exchangeDeals.dealDate, startDate),
              lte(exchangeDeals.dealDate, endDate),
              isNull(exchangeDeals.deletedAt)
            ),
            with: {
              seller: true,
              buyer: true,
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
