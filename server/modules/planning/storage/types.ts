import type { InferSelectModel, InferInsertModel } from "drizzle-orm";
import type {
  planEntries,
  freeVolumeAllocations,
  supplierAllocatedVolumes,
  planningResources,
  planningSettings,
  planningComments,
  planningScenarios,
  planningTopLevelVolumes,
  warehouseSupplyTags,
} from "../entities/planning";

export type PlanEntry = InferSelectModel<typeof planEntries>;
export type InsertPlanEntry = InferInsertModel<typeof planEntries>;

export type FreeVolumeAllocation = InferSelectModel<typeof freeVolumeAllocations>;
export type InsertFreeVolumeAllocation = InferInsertModel<typeof freeVolumeAllocations>;

export interface FreeVolumeAllocationWithNames extends FreeVolumeAllocation {
  fromName?: string | null;
  toName?: string | null;
}

export type SupplierAllocatedVolume = InferSelectModel<typeof supplierAllocatedVolumes>;
export type InsertSupplierAllocatedVolume = InferInsertModel<typeof supplierAllocatedVolumes>;

export type PlanningResource = InferSelectModel<typeof planningResources>;
export type InsertPlanningResource = InferInsertModel<typeof planningResources>;
export interface PlanningResourceWithSupplier extends PlanningResource {
  supplierName: string;
}

export type PlanningSetting = InferSelectModel<typeof planningSettings>;

export type PlanningComment = InferSelectModel<typeof planningComments>;
export type InsertPlanningComment = InferInsertModel<typeof planningComments>;
export interface PlanningCommentWithUser extends PlanningComment {
  userName: string;
}

export interface PlanEntryWithMeta extends PlanEntry {
  isLocked: boolean;
  counterpartyName?: string | null;
  basisName?: string | null;
}

export interface ActualDetailItem {
  sourceType: string;
  sourceId: string;
  label: string;
  quantity: string;
  date: string;
  isExpense: boolean;
  balanceAfter: string | null;
  counterpartyName?: string | null;
}

export interface PlanningResourceWithBasis {
  id: string;
  supplierId: string;
  supplierName: string;
  basisId?: string | null;
  basisName?: string | null;
  notes?: string | null;
}

export interface ActualsByDate {
  date: string;
  incomeActual: string;
  expenseActual: string;
  factBalanceAfter: string | null;
  details: ActualDetailItem[];
}

export interface ResourceSummaryRow {
  supplierId: string | null;
  supplierName: string;
  allocatedVolume: string;
  demand: string;
  balance: string;
  topLevelVolume: string;
  isUnassigned?: boolean;
}

export interface WarehouseSummaryRow {
  warehouseId: string;
  warehouseName: string;
  plannedIncome: string;
  plannedExpense: string;
  balancePlan: string;
  balanceFact: string;
}

export interface CustomerWarehouseVolume {
  warehouseId: string;
  warehouseName: string;
  volume: string;
}

export interface CustomerSummaryRow {
  customerId: string;
  customerName: string;
  volume: string;
  warehouses: CustomerWarehouseVolume[];
}

// Scenarios
export type PlanningScenario = InferSelectModel<typeof planningScenarios>;
export type InsertPlanningScenario = InferInsertModel<typeof planningScenarios>;

// Top-level volumes
export type PlanningTopLevelVolume = InferSelectModel<typeof planningTopLevelVolumes>;
export type InsertPlanningTopLevelVolume = InferInsertModel<typeof planningTopLevelVolumes>;

export interface PlanningTopLevelVolumeWithNames extends PlanningTopLevelVolume {
  warehouseName?: string;
  counterpartyName?: string | null;
}

export interface TopLevelWarehouseSummary {
  warehouseId: string;
  warehouseName: string;
  topLevelIncome: string;
  topLevelExpense: string;
}

// Warehouse supply tags
export type WarehouseSupplyTag = InferSelectModel<typeof warehouseSupplyTags>;
export type InsertWarehouseSupplyTag = InferInsertModel<typeof warehouseSupplyTags>;

export interface WarehouseSupplyTagWithSupplier extends WarehouseSupplyTag {
  supplierName?: string | null;
}

export interface IPlanningStorage {
  // Scenarios
  getPlanningScenarios(): Promise<PlanningScenario[]>;
  createPlanningScenario(data: InsertPlanningScenario): Promise<PlanningScenario>;
  updatePlanningScenario(id: string, data: Partial<InsertPlanningScenario>, userId?: string): Promise<PlanningScenario | undefined>;
  deletePlanningScenario(id: string, userId?: string): Promise<boolean>;
  clonePlanningScenario(sourceScenarioId: string | null, newScenario: InsertPlanningScenario): Promise<PlanningScenario>;

  getPlanEntries(warehouseId: string, dateFrom: string, dateTo: string, scenarioId?: string | null): Promise<PlanEntryWithMeta[]>;
  getPlanEntry(id: string): Promise<PlanEntry | undefined>;
  createPlanEntry(data: InsertPlanEntry): Promise<PlanEntry>;
  updatePlanEntry(id: string, data: Partial<InsertPlanEntry>, userId?: string): Promise<PlanEntry | undefined>;
  deletePlanEntry(id: string, userId?: string): Promise<boolean>;

  getFreeVolumeAllocations(warehouseId: string, dateFrom: string, dateTo: string): Promise<FreeVolumeAllocationWithNames[]>;
  createFreeVolumeAllocation(data: InsertFreeVolumeAllocation): Promise<FreeVolumeAllocation>;
  updateFreeVolumeAllocation(id: string, data: Partial<InsertFreeVolumeAllocation>, userId?: string): Promise<FreeVolumeAllocation | undefined>;
  deleteFreeVolumeAllocation(id: string, userId?: string): Promise<boolean>;

  getSupplierAllocatedVolumes(periodFrom: string, periodTo: string): Promise<SupplierAllocatedVolume[]>;
  upsertSupplierAllocatedVolume(data: InsertSupplierAllocatedVolume): Promise<SupplierAllocatedVolume>;
  getSupplierAllocatedVolumesBySupplier(supplierId: string): Promise<SupplierAllocatedVolume[]>;

  getPlanningResources(): Promise<PlanningResourceWithSupplier[]>;
  createPlanningResource(data: InsertPlanningResource): Promise<PlanningResource>;
  updatePlanningResource(id: string, data: Partial<InsertPlanningResource>, userId?: string): Promise<PlanningResource | undefined>;
  deletePlanningResource(id: string, userId?: string): Promise<boolean>;

  getPlanningSettings(): Promise<Record<string, string>>;
  upsertPlanningSetting(key: string, value: string, userId?: string): Promise<void>;

  getPlanningComments(entityType: string, entityId: string, fieldKey: string): Promise<PlanningCommentWithUser[]>;
  createPlanningComment(data: InsertPlanningComment): Promise<PlanningComment>;
  updatePlanningComment(id: string, userId: string, data: { text?: string; isHighPriority?: boolean }): Promise<PlanningComment>;
  deletePlanningComment(id: string, userId: string): Promise<boolean>;

  getActuals(warehouseId: string, dateFrom: string, dateTo: string): Promise<ActualsByDate[]>;

  getResourcesSummary(periodFrom: string, periodTo: string, scenarioId?: string | null): Promise<ResourceSummaryRow[]>;
  getWarehousesSummary(periodFrom: string, periodTo: string, scenarioId?: string | null): Promise<WarehouseSummaryRow[]>;
  getCustomersSummary(periodFrom: string, periodTo: string, scenarioId?: string | null): Promise<CustomerSummaryRow[]>;

  // Top-level volumes
  getTopLevelVolumes(supplierId: string, periodFrom: string, periodTo: string, scenarioId?: string | null): Promise<PlanningTopLevelVolumeWithNames[]>;
  createTopLevelVolume(data: InsertPlanningTopLevelVolume): Promise<PlanningTopLevelVolume>;
  updateTopLevelVolume(id: string, data: Partial<InsertPlanningTopLevelVolume>, userId?: string): Promise<PlanningTopLevelVolume | undefined>;
  deleteTopLevelVolume(id: string, userId?: string): Promise<boolean>;
  getTopLevelWarehouseSummary(warehouseId: string, periodFrom: string, periodTo: string, scenarioId?: string | null): Promise<TopLevelWarehouseSummary>;

  // Warehouse supply tags
  getWarehouseSupplyTags(warehouseId: string): Promise<WarehouseSupplyTagWithSupplier[]>;
  createWarehouseSupplyTag(data: InsertWarehouseSupplyTag): Promise<WarehouseSupplyTag>;
  deleteWarehouseSupplyTag(id: string, userId?: string): Promise<boolean>;
}
