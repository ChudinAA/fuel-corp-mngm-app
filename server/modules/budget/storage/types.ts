
import type { InferSelectModel, InferInsertModel } from "drizzle-orm";
import type { budgetIncomeExpense } from "../entities/budget";

export type BudgetIncomeExpense = InferSelectModel<typeof budgetIncomeExpense>;
export type InsertBudgetIncomeExpense = InferInsertModel<typeof budgetIncomeExpense>;

export interface IBudgetStorage {
  getBudgetEntry(id: string): Promise<BudgetIncomeExpense | undefined>;
  getBudgetEntries(filters?: {
    startMonth?: string;
    endMonth?: string;
  }): Promise<BudgetIncomeExpense[]>;
  createBudgetEntry(data: InsertBudgetIncomeExpense): Promise<BudgetIncomeExpense>;
  updateBudgetEntry(id: string, data: Partial<InsertBudgetIncomeExpense>): Promise<BudgetIncomeExpense | undefined>;
  deleteBudgetEntry(id: string, userId?: string): Promise<boolean>;
  updateBudgetFromSales(budgetMonth: string): Promise<BudgetIncomeExpense | undefined>;
}
