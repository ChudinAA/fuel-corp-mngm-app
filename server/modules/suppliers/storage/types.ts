import { InsertSupplier, Supplier } from "@shared/schema";

export interface ISupplierStorage {
  getAllSuppliers(): Promise<Supplier[]>;
  getSupplier(id: string): Promise<Supplier | undefined>;
  createSupplier(data: InsertSupplier): Promise<Supplier>;
  updateSupplier(
    id: string,
    data: Partial<InsertSupplier>
  ): Promise<Supplier | undefined>;
  deleteSupplier(id: string): Promise<boolean>;
}
