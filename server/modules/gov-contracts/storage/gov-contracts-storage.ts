import { eq, desc, sql, and, isNull, gte, lte } from "drizzle-orm";
import { db } from "server/db";
import { governmentContracts, type GovernmentContract, type InsertGovernmentContract } from "@shared/schema";
import { opt } from "../../opt/entities/opt";
import { optMassTonnesSql } from "../../opt/opt-mass-sql";
import { aircraftRefueling } from "../../refueling/entities/refueling";
import { GovernmentContractSalesUpdate, IGovernmentContractStorage } from "./types";
import { kilogramsToTonnes } from "@shared/units";

function storedKilogramsToTonnes(value: string | null | undefined): number | null {
  if (value == null || value.trim() === "") return null;
  const kilograms = Number(value);
  if (!Number.isFinite(kilograms)) {
    throw new TypeError("Government contract mass must be a finite kilogram value");
  }
  return kilogramsToTonnes(kilograms);
}

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

  async updateContractFromSales(contractId: string): Promise<GovernmentContractSalesUpdate> {
    const contract = await this.getGovernmentContract(contractId);

    if (!contract) {
      throw new Error("Contract not found");
    }

    // Получаем продажи ОПТ по контракту
    const [optSales] = await db
      .select({
        totalVolume: sql<string>`COALESCE(SUM(${optMassTonnesSql()}) * 1000, 0)::text`,
        totalRevenue: sql<string>`COALESCE(SUM(CAST(${opt.saleAmount} AS NUMERIC)), 0)`,
      })
      .from(opt)
      .where(
        and(
          eq(opt.buyerId, contract.customerId!),
          gte(opt.dealDate, contract.startDate),
          lte(opt.dealDate, contract.endDate || new Date().toISOString()),
          isNull(opt.deletedAt)
        )
      );

    // Получаем продажи ЗВС по контракту
    const [refuelingSales] = await db
      .select({
        totalVolume: sql<string>`COALESCE(SUM(COALESCE(
          ${aircraftRefueling.quantityTonnes},
          CAST(${aircraftRefueling.quantityKg} AS NUMERIC) / 1000
        )) * 1000, 0)::text`,
        totalRevenue: sql<string>`COALESCE(SUM(CAST(${aircraftRefueling.saleAmount} AS NUMERIC)), 0)`,
      })
      .from(aircraftRefueling)
      .where(
        and(
          gte(aircraftRefueling.refuelingDate, contract.startDate),
          lte(aircraftRefueling.refuelingDate, contract.endDate || new Date().toISOString()),
          isNull(aircraftRefueling.deletedAt)
        )
      );

    const totalActualVolume = (
      parseFloat(optSales?.totalVolume || "0") + 
      parseFloat(refuelingSales?.totalVolume || "0")
    ).toString();

    const totalActualRevenue = (
      parseFloat(optSales?.totalRevenue || "0") + 
      parseFloat(refuelingSales?.totalRevenue || "0")
    ).toString();

    const remainingAmount = contract.totalAmount 
      ? (parseFloat(contract.totalAmount) - parseFloat(totalActualRevenue)).toString()
      : "0";

    // Обновляем контракт
    await this.updateGovernmentContract(contractId, {
      actualVolume: totalActualVolume,
      currentAmount: totalActualRevenue,
      remainingAmount: remainingAmount,
    });

    return {
      contractId,
      plannedVolumeTonnes: storedKilogramsToTonnes(contract.plannedVolume),
      actualVolumeTonnes: storedKilogramsToTonnes(totalActualVolume),
      plannedAmount: contract.totalAmount,
      actualAmount: totalActualRevenue,
      completion: contract.plannedVolume 
        ? ((parseFloat(totalActualVolume) / parseFloat(contract.plannedVolume)) * 100).toFixed(2)
        : "0",
    };
  }

  async getContractCompletionStatus(contractId: string): Promise<any> {
    const contract = await this.getGovernmentContract(contractId);

    if (!contract) {
      throw new Error("Contract not found");
    }

    const plannedVolume = parseFloat(contract.plannedVolume || "0");
    const actualVolume = parseFloat(contract.actualVolume || "0");
    const plannedAmount = parseFloat(contract.totalAmount || "0");
    const actualAmount = parseFloat(contract.currentAmount || "0");

    const volumeCompletion = plannedVolume > 0 ? (actualVolume / plannedVolume) * 100 : 0;
    const amountCompletion = plannedAmount > 0 ? (actualAmount / plannedAmount) * 100 : 0;

    const remainingVolume = Math.max(0, plannedVolume - actualVolume);
    const remainingAmount = Math.max(0, plannedAmount - actualAmount);

    // Определяем статус
    let status = contract.status;
    if (volumeCompletion >= 100 || amountCompletion >= 100) {
      status = 'completed';
    } else if (contract.endDate && new Date(contract.endDate) < new Date()) {
      status = 'expired';
    }

    return {
      contractId,
      contractNumber: contract.contractNumber,
      customerId: contract.customerId,
      planned: {
        volumeTonnes: kilogramsToTonnes(plannedVolume),
        amount: plannedAmount.toString(),
      },
      actual: {
        volumeTonnes: kilogramsToTonnes(actualVolume),
        amount: actualAmount.toString(),
      },
      remaining: {
        volumeTonnes: kilogramsToTonnes(remainingVolume),
        amount: remainingAmount.toString(),
      },
      completion: {
        volumePercent: volumeCompletion.toFixed(2),
        amountPercent: amountCompletion.toFixed(2),
      },
      status,
      daysRemaining: contract.endDate 
        ? Math.ceil((new Date(contract.endDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))
        : null,
    };
  }
}