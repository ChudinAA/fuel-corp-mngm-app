import type { Transportation, InsertTransportation } from "../entities/transportation";

export interface ITransportationStorage {
  getTransportation(id: string): Promise<Transportation | undefined>;
  getTransportationDeals(
    offset: number,
    pageSize: number,
    search?: string,
    filters?: Record<string, string[]>,
  ): Promise<{ data: any[]; total: number }>;
  createTransportation(data: InsertTransportation): Promise<Transportation>;
  updateTransportation(
    id: string,
    data: Partial<InsertTransportation>,
  ): Promise<Transportation | undefined>;
  deleteTransportation(id: string, userId?: string): Promise<boolean>;
  restoreTransportation(id: string, oldData: any, userId?: string): Promise<boolean>;
  checkDuplicate(data: {
    dealDate: string;
    supplierId: string;
    buyerId: string;
    productType: string;
    basisId?: string | null;
    customerBasisId?: string | null;
    deliveryLocationId?: string | null;
    quantityKg: number;
  }): Promise<boolean>;
}
