import type { InferSelectModel, InferInsertModel } from "drizzle-orm";
import type {
  planEntries,
  freeVolumeAllocations,
  supplierAllocatedVolumes,
} from "../entities/planning";

export type PlanEntry = InferSelectModel<typeof planEntries>;
export type InsertPlanEntry = InferInsertModel<typeof planEntries>;

export type FreeVolumeAllocation = InferSelectModel<
  typeof freeVolumeAllocations
>;
export type InsertFreeVolumeAllocation = InferInsertModel<
  typeof freeVolumeAllocations
>;

export type SupplierAllocatedVolume = InferSelectModel<
  typeof supplierAllocatedVolumes
>;
export type InsertSupplierAllocatedVolume = InferInsertModel<
  typeof supplierAllocatedVolumes
>;

export interface PlanEntryWithMeta extends PlanEntry {
  isLocked: boolean;
  counterpartyName?: string | null;
}

export interface ActualDetailItem {
  sourceType: string;
  sourceId: string;
  label: string;
  quantity: string;
  date: string;
}

export interface ActualsByDate {
  date: string;
  incomeActual: string;
  expenseActual: string;
  details: ActualDetailItem[];
}

export interface ResourceSummaryRow {
  supplierId: string;
  supplierName: string;
  allocatedVolume: string;
  demand: string;
  balance: string;
}

export interface WarehouseSummaryRow {
  warehouseId: string;
  warehouseName: string;
  plannedIncome: string;
  plannedExpense: string;
  balance: string;
}

export interface CustomerSummaryRow {
  customerId: string;
  customerName: string;
  volume: string;
}

export interface IPlanningStorage {
  getPlanEntries(
    warehouseId: string,
    dateFrom: string,
    dateTo: string,
  ): Promise<PlanEntryWithMeta[]>;
  getPlanEntry(id: string): Promise<PlanEntry | undefined>;
  createPlanEntry(
    data: InsertPlanEntry,
  ): Promise<PlanEntry>;
  updatePlanEntry(
    id: string,
    data: Partial<InsertPlanEntry>,
    userId?: string,
  ): Promise<PlanEntry | undefined>;
  deletePlanEntry(id: string, userId?: string): Promise<boolean>;

  getFreeVolumeAllocations(
    warehouseId: string,
    dateFrom: string,
    dateTo: string,
  ): Promise<FreeVolumeAllocation[]>;
  createFreeVolumeAllocation(
    data: InsertFreeVolumeAllocation,
  ): Promise<FreeVolumeAllocation>;
  updateFreeVolumeAllocation(
    id: string,
    data: Partial<InsertFreeVolumeAllocation>,
    userId?: string,
  ): Promise<FreeVolumeAllocation | undefined>;
  deleteFreeVolumeAllocation(id: string, userId?: string): Promise<boolean>;

  getSupplierAllocatedVolumes(
    periodFrom: string,
    periodTo: string,
  ): Promise<SupplierAllocatedVolume[]>;
  upsertSupplierAllocatedVolume(
    data: InsertSupplierAllocatedVolume,
  ): Promise<SupplierAllocatedVolume>;

  getActuals(
    warehouseId: string,
    dateFrom: string,
    dateTo: string,
  ): Promise<ActualsByDate[]>;

  getResourcesSummary(
    periodFrom: string,
    periodTo: string,
  ): Promise<ResourceSummaryRow[]>;
  getWarehousesSummary(
    periodFrom: string,
    periodTo: string,
  ): Promise<WarehouseSummaryRow[]>;
  getCustomersSummary(
    periodFrom: string,
    periodTo: string,
  ): Promise<CustomerSummaryRow[]>;
}
