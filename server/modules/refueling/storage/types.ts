import { AircraftRefueling, InsertAircraftRefueling } from "@shared/schema";

export interface IAircraftRefuelingStorage {
  getRefuelings(
    page: number,
    pageSize: number
  ): Promise<{ data: AircraftRefueling[]; total: number }>;
  createRefueling(data: InsertAircraftRefueling): Promise<AircraftRefueling>;
  updateRefueling(
    id: string,
    data: Partial<InsertAircraftRefueling>
  ): Promise<AircraftRefueling | undefined>;
  deleteRefueling(id: string): Promise<boolean>;
  getUsedVolumeByPrice(priceId: string): Promise<number>;
  checkDuplicate(data: {
    refuelingDate: string;
    supplierId: string;
    buyerId: string;
    basis: string;
    quantityKg: number;
  }): Promise<boolean>;
}
