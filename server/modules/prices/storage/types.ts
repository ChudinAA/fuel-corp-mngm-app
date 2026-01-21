import { InsertPrice, Price } from "@shared/schema";

export interface IPriceStorage {
  getAllPrices(filters?: {
    dateFrom?: string;
    dateTo?: string;
    counterpartyType?: string;
    counterpartyRole?: string;
    counterpartyId?: string;
    basis?: string;
    productType?: string;
  }): Promise<Price[]>;
  getPrice(id: string): Promise<Price | undefined>;
  getPricesByRole(
    counterpartyRole: string,
    counterpartyType: string
  ): Promise<Price[]>;
  createPrice(data: InsertPrice): Promise<Price>;
  updatePrice(
    id: string,
    data: Partial<InsertPrice>
  ): Promise<Price | undefined>;
  deletePrice(id: string): Promise<boolean>;
  calculatePriceSelection(
    counterpartyId: string,
    counterpartyType: string,
    basis: string,
    dateFrom: string,
    dateTo: string,
    priceId?: string
  ): Promise<number>;
  checkPriceDateOverlaps(
    counterpartyId: string,
    counterpartyType: string,
    counterpartyRole: string,
    basis: string,
    dateFrom: string,
    dateTo: string,
    excludeId?: string
  ): Promise<{
    status: string;
    message: string;
    overlaps?: { id: string; dateFrom: string; dateTo: string }[];
  }>;
}
