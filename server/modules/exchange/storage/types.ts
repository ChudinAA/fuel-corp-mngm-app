import { Exchange, InsertExchange } from "@shared/schema";

export interface IExchangeStorage {
  getExchangeDeals(
    page: number,
    pageSize: number
  ): Promise<{ data: Exchange[]; total: number }>;
  createExchange(data: InsertExchange): Promise<Exchange>;
  updateExchange(
    id: string,
    data: Partial<InsertExchange>
  ): Promise<Exchange | undefined>;
  deleteExchange(id: string): Promise<boolean>;
}
