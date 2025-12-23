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
}
