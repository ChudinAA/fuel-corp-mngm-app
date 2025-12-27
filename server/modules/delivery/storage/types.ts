
import { InsertDeliveryCost, DeliveryCost } from "@shared/schema";

export interface IDeliveryStorage {
  getAllDeliveryCosts(): Promise<DeliveryCost[]>;
  getDeliveryCost(id: string): Promise<DeliveryCost | undefined>;
  createDeliveryCost(data: InsertDeliveryCost, userId: string): Promise<DeliveryCost>;
  updateDeliveryCost(
    id: string,
    data: Partial<InsertDeliveryCost>,
    userId: string
  ): Promise<DeliveryCost | undefined>;
  deleteDeliveryCost(id: string, userId: string): Promise<boolean>;
}
