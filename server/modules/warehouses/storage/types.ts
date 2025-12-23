import { InsertWarehouse, Warehouse } from "@shared/schema";

export interface IWarehouseStorage {
  getAllWarehouses(): Promise<Warehouse[]>;
  getWarehouse(id: string): Promise<Warehouse | undefined>;
  createWarehouse(data: InsertWarehouse): Promise<Warehouse>;
  updateWarehouse(
    id: string,
    data: Partial<InsertWarehouse>
  ): Promise<Warehouse | undefined>;
  deleteWarehouse(id: string): Promise<boolean>;
  getWarehouseTransactions(warehouseId: string): Promise<any[]>;
  getWarehouseStatsForDashboard(): Promise<any[]>;
}
