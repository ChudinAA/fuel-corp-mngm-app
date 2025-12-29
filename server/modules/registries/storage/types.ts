
import type { RegistryTemplate, InsertRegistryTemplate } from "../entities/registries";

export interface IRegistriesStorage {
  getRegistryTemplate(id: string): Promise<RegistryTemplate | undefined>;
  getRegistryTemplates(templateType?: string): Promise<RegistryTemplate[]>;
  createRegistryTemplate(data: InsertRegistryTemplate): Promise<RegistryTemplate>;
  updateRegistryTemplate(id: string, data: Partial<InsertRegistryTemplate>): Promise<RegistryTemplate | undefined>;
  deleteRegistryTemplate(id: string, userId?: string): Promise<boolean>;
}
