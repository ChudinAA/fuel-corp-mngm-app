import { InsertMovement, Movement } from "@shared/schema";

export interface IMovementStorage {
  getMovements(
    page: number,
    pageSize: number
  ): Promise<{ data: Movement[]; total: number }>;
  createMovement(data: InsertMovement): Promise<Movement>;
  updateMovement(
    id: string,
    data: Partial<InsertMovement>
  ): Promise<Movement | undefined>;
  deleteMovement(id: string): Promise<boolean>;
}
