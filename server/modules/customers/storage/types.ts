import { Customer, InsertCustomer } from "@shared/schema";

export interface ICustomerStorage {
  getAllCustomers(module?: string): Promise<Customer[]>;
  getCustomer(id: string): Promise<Customer | undefined>;
  createCustomer(data: InsertCustomer): Promise<Customer>;
  updateCustomer(
    id: string,
    data: Partial<InsertCustomer>
  ): Promise<Customer | undefined>;
  deleteCustomer(id: string): Promise<boolean>;
}
