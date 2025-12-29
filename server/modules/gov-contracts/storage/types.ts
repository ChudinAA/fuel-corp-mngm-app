
import type { InferSelectModel, InferInsertModel } from "drizzle-orm";
import type { governmentContracts } from "../entities/gov-contracts";

export type GovernmentContract = InferSelectModel<typeof governmentContracts>;
export type InsertGovernmentContract = InferInsertModel<typeof governmentContracts>;

export interface IGovernmentContractStorage {
  getGovernmentContract(id: string): Promise<GovernmentContract | undefined>;
  getGovernmentContracts(filters?: {
    status?: string;
    customerId?: string;
  }): Promise<GovernmentContract[]>;
  createGovernmentContract(data: InsertGovernmentContract): Promise<GovernmentContract>;
  updateGovernmentContract(id: string, data: Partial<InsertGovernmentContract>): Promise<GovernmentContract | undefined>;
  deleteGovernmentContract(id: string, userId?: string): Promise<boolean>;
  updateContractFromSales(contractId: string): Promise<GovernmentContract | undefined>;
}
