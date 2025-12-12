import { eq, asc, sql } from "drizzle-orm";
import { db } from "../db";
import type { IWholesaleStorage } from "./types";

// This storage is no longer needed as wholesale suppliers and bases
// are now unified into suppliers and bases tables
export class WholesaleStorage implements IWholesaleStorage {
  async getAllWholesaleSuppliers(): Promise<any[]> {
    throw new Error("Use SupplierStorage instead");
  }

  async getWholesaleSupplier(id: string): Promise<any> {
    throw new Error("Use SupplierStorage instead");
  }

  async createWholesaleSupplier(data: any): Promise<any> {
    throw new Error("Use SupplierStorage instead");
  }

  async updateWholesaleSupplier(id: string, data: any): Promise<any> {
    throw new Error("Use SupplierStorage instead");
  }

  async deleteWholesaleSupplier(id: string): Promise<boolean> {
    throw new Error("Use SupplierStorage instead");
  }

  async getAllWholesaleBases(supplierId?: string): Promise<any[]> {
    throw new Error("Use BaseStorage instead");
  }

  async getWholesaleBase(id: string): Promise<any> {
    throw new Error("Use BaseStorage instead");
  }

  async createWholesaleBase(data: any): Promise<any> {
    throw new Error("Use BaseStorage instead");
  }

  async updateWholesaleBase(id: string, data: any): Promise<any> {
    throw new Error("Use BaseStorage instead");
  }

  async deleteWholesaleBase(id: string): Promise<boolean> {
    throw new Error("Use BaseStorage instead");
  }
}