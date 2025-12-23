import { Base, InsertBase } from "@shared/schema";

export interface IBaseStorage {
  getAllBases(baseType?: string): Promise<Base[]>;
  getBase(id: string): Promise<Base | undefined>;
  createBase(data: InsertBase): Promise<Base>;
  updateBase(id: string, data: Partial<InsertBase>): Promise<Base | undefined>;
  deleteBase(id: string): Promise<boolean>;
}
