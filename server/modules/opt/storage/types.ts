import { InsertOpt, Opt } from "@shared/schema";

export interface IOptStorage {
  getOptDeals(
    page: number,
    pageSize: number
  ): Promise<{ data: Opt[]; total: number }>;
  getAllOpts(): Promise<any[]>;
  createOpt(data: InsertOpt): Promise<Opt>;
  updateOpt(id: string, data: Partial<InsertOpt>): Promise<Opt | undefined>;
  deleteOpt(id: string): Promise<boolean>;
  getUsedVolumeByPrice(priceId: string): Promise<number>;
  checkDuplicate(data: {
    dealDate: string;
    supplierId: string;
    buyerId: string;
    basis?: string | null;
    deliveryLocationId?: string | null;
    quantityKg: number;
  }): Promise<boolean>;
}
