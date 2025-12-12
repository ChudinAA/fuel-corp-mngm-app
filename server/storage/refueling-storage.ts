import { eq, asc, sql } from "drizzle-orm";
import { db } from "../db";
import type { IRefuelingStorage } from "./types";

// This storage is no longer needed as refueling providers and bases
// are now unified into suppliers and bases tables
export class RefuelingStorage implements IRefuelingStorage {
  async getAllRefuelingProviders(): Promise<any[]> {
    // Redirect to unified suppliers
    throw new Error("Use SupplierStorage instead");
  }

  async getRefuelingProvider(id: string): Promise<any> {
    throw new Error("Use SupplierStorage instead");
  }

  async createRefuelingProvider(data: any): Promise<any> {
    throw new Error("Use SupplierStorage instead");
  }

  async updateRefuelingProvider(id: string, data: any): Promise<any> {
    throw new Error("Use SupplierStorage instead");
  }

  async deleteRefuelingProvider(id: string): Promise<boolean> {
    throw new Error("Use SupplierStorage instead");
  }

  async getAllRefuelingBases(providerId?: string): Promise<any[]> {
    throw new Error("Use BaseStorage instead");
  }

  async getRefuelingBase(id: string): Promise<any> {
    throw new Error("Use BaseStorage instead");
  }

  async createRefuelingBase(data: any): Promise<any> {
    throw new Error("Use BaseStorage instead");
  }

  async updateRefuelingBase(id: string, data: any): Promise<any> {
    throw new Error("Use BaseStorage instead");
  }

  async deleteRefuelingBase(id: string): Promise<boolean> {
    throw new Error("Use BaseStorage instead");
  }
}