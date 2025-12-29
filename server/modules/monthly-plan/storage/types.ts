
import type { InferSelectModel, InferInsertModel } from "drizzle-orm";
import type { monthlyPlans } from "../entities/monthly-plan";

export type MonthlyPlan = InferSelectModel<typeof monthlyPlans>;
export type InsertMonthlyPlan = InferInsertModel<typeof monthlyPlans>;

export interface IMonthlyPlanStorage {
  getMonthlyPlan(id: string): Promise<MonthlyPlan | undefined>;
  getMonthlyPlans(filters?: {
    planMonth?: string;
    planType?: string;
    baseId?: string;
  }): Promise<MonthlyPlan[]>;
  createMonthlyPlan(data: InsertMonthlyPlan): Promise<MonthlyPlan>;
  updateMonthlyPlan(id: string, data: Partial<InsertMonthlyPlan>): Promise<MonthlyPlan | undefined>;
  deleteMonthlyPlan(id: string, userId?: string): Promise<boolean>;
  getPlanVsActual(planId: string): Promise<any>;
  copyPlan(sourcePlanId: string, targetMonth: string, userId: string): Promise<any>;
}
