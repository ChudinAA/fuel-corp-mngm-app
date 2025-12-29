
import { eq, desc, sql, and, isNull, gte, lte } from "drizzle-orm";
import { db } from "server/db";
import { governmentContracts, type GovernmentContract, type InsertGovernmentContract } from "@shared/schema";
import { opt } from "../../opt/entities/opt";
import { aircraftRefueling } from "../../refueling/entities/refueling";
import { IGovernmentContractStorage } from "./types";

export class GovernmentContractStorage implements IGovernmentContractStorage {
  async getGovernmentContract(id: string): Promise<GovernmentContract | undefined> {
    return db.query.governmentContracts.findFirst({
      where: and(eq(governmentContracts.id, id), isNull(governmentContracts.deletedAt)),
      with: {
        createdBy: {
          columns: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        customer: true,
      },
    });
  }

  async getGovernmentContracts(filters?: {
    status?: string;
    customerId?: string;
  }): Promise<GovernmentContract[]> {
    const conditions = [isNull(governmentContracts.deletedAt)];
    
    if (filters?.status) {
      conditions.push(eq(governmentContracts.status, filters.status));
    }
    
    if (filters?.customerId) {
      conditions.push(eq(governmentContracts.customerId, filters.customerId));
    }

    return db.query.governmentContracts.findMany({
      where: and(...conditions),
      orderBy: [desc(governmentContracts.startDate)],
      with: {
        createdBy: {
          columns: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        customer: true,
      },
    });
  }

  async createGovernmentContract(data: InsertGovernmentContract): Promise<GovernmentContract> {
    const [created] = await db.insert(governmentContracts).values(data).returning();
    return created;
  }

  async updateGovernmentContract(
    id: string,
    data: Partial<InsertGovernmentContract>
  ): Promise<GovernmentContract | undefined> {
    const [updated] = await db
      .update(governmentContracts)
      .set({
        ...data,
        updatedAt: sql`NOW()`,
      })
      .where(eq(governmentContracts.id, id))
      .returning();

    return updated;
  }

  async deleteGovernmentContract(id: string, userId?: string): Promise<boolean> {
    await db
      .update(governmentContracts)
      .set({
        deletedAt: sql`NOW()`,
        deletedById: userId,
      })
      .where(eq(governmentContracts.id, id));

    return true;
  }

  async updateContractFromSales(contractId: string): Promise<GovernmentContract | undefined> {
    const contract = await this.getGovernmentContract(contractId);
    if (!contract) return undefined;

    // Агрегация данных из ОПТа
    const optSales = await db
      .select({
        totalVolume: sql<string>`COALESCE(SUM(CAST(${opt.quantityKg} AS NUMERIC)), 0)`,
        totalAmount: sql<string>`COALESCE(SUM(CAST(${opt.saleAmount} AS NUMERIC)), 0)`,
      })
      .from(opt)
      .where(
        and(
          eq(opt.buyerId, contract.customerId!),
          gte(opt.dealDate, contract.startDate),
          lte(opt.dealDate, contract.endDate),
          isNull(opt.deletedAt)
        )
      );

    // Агрегация данных из ЗВС
    const refuelingSales = await db
      .select({
        totalVolume: sql<string>`COALESCE(SUM(CAST(${aircraftRefueling.quantityKg} AS NUMERIC)), 0)`,
        totalAmount: sql<string>`COALESCE(SUM(CAST(${aircraftRefueling.saleAmount} AS NUMERIC)), 0)`,
      })
      .from(aircraftRefueling)
      .where(
        and(
          eq(aircraftRefueling.buyerId, contract.customerId!),
          gte(aircraftRefueling.refuelingDate, contract.startDate),
          lte(aircraftRefueling.refuelingDate, contract.endDate),
          isNull(aircraftRefueling.deletedAt)
        )
      );

    const totalVolume = (
      parseFloat(optSales[0]?.totalVolume || "0") + 
      parseFloat(refuelingSales[0]?.totalVolume || "0")
    ).toString();

    const totalAmount = (
      parseFloat(optSales[0]?.totalAmount || "0") + 
      parseFloat(refuelingSales[0]?.totalAmount || "0")
    ).toString();

    const remainingAmount = contract.totalAmount 
      ? (parseFloat(contract.totalAmount) - parseFloat(totalAmount)).toString()
      : "0";

    return this.updateGovernmentContract(contractId, {
      actualVolume: totalVolume,
      currentAmount: totalAmount,
      remainingAmount: remainingAmount,
    });
  }
}
