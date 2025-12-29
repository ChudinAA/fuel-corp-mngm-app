
import { eq, desc, sql, and, isNull } from "drizzle-orm";
import { db } from "server/db";
import { savedReports, type SavedReport, type InsertSavedReport } from "@shared/schema";
import { IReportsStorage } from "./types";

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

  async updateSavedReport(
    id: string,
    data: Partial<InsertSavedReport>
  ): Promise<SavedReport | undefined> {
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
}
