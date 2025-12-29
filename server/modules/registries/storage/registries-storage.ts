
import { eq, desc, sql, and, isNull } from "drizzle-orm";
import { db } from "server/db";
import { registryTemplates } from "../entities/registries";
import type { RegistryTemplate, InsertRegistryTemplate } from "../entities/registries";
import { IRegistriesStorage } from "./types";

export class RegistriesStorage implements IRegistriesStorage {
  async getRegistryTemplate(id: string): Promise<RegistryTemplate | undefined> {
    return db.query.registryTemplates.findFirst({
      where: and(eq(registryTemplates.id, id), isNull(registryTemplates.deletedAt)),
      with: {
        createdBy: {
          columns: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    });
  }

  async getRegistryTemplates(templateType?: string): Promise<RegistryTemplate[]> {
    const conditions = [isNull(registryTemplates.deletedAt)];
    
    if (templateType) {
      conditions.push(eq(registryTemplates.templateType, templateType));
    }

    return db.query.registryTemplates.findMany({
      where: and(...conditions),
      orderBy: [desc(registryTemplates.createdAt)],
      with: {
        createdBy: {
          columns: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    });
  }

  async createRegistryTemplate(data: InsertRegistryTemplate): Promise<RegistryTemplate> {
    const [created] = await db.insert(registryTemplates).values(data).returning();
    return created;
  }

  async updateRegistryTemplate(
    id: string,
    data: Partial<InsertRegistryTemplate>
  ): Promise<RegistryTemplate | undefined> {
    const [updated] = await db
      .update(registryTemplates)
      .set({
        ...data,
        updatedAt: sql`NOW()`,
      })
      .where(eq(registryTemplates.id, id))
      .returning();

    return updated;
  }

  async deleteRegistryTemplate(id: string, userId?: string): Promise<boolean> {


  async getRegistriesByTemplate(
    templateType: string,
    filters?: {
      startDate?: string;
      endDate?: string;
      baseId?: string;
      customerId?: string;
    }
  ): Promise<any> {
    const conditions = [
      eq(registries.templateType, templateType),
      isNull(registries.deletedAt)
    ];

    if (filters?.startDate) {
      conditions.push(gte(registries.periodStart, filters.startDate));
    }

    if (filters?.endDate) {
      conditions.push(lte(registries.periodEnd, filters.endDate));
    }

    if (filters?.baseId) {
      conditions.push(eq(registries.baseId, filters.baseId));
    }

    if (filters?.customerId) {
      conditions.push(eq(registries.customerId, filters.customerId));
    }

    return db.query.registries.findMany({
      where: and(...conditions),
      orderBy: [desc(registries.periodStart)],
      with: {
        base: true,
        customer: true,
        createdBy: {
          columns: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    });
  }

  async prepareRegistryForExport(id: string): Promise<any> {
    const registry = await this.getRegistry(id);
    
    if (!registry) {
      throw new Error("Registry not found");
    }

    // Формируем данные для экспорта в зависимости от шаблона
    const exportData = {
      metadata: {
        registryName: registry.registryName,
        templateType: registry.templateType,
        period: {
          start: registry.periodStart,
          end: registry.periodEnd,
        },
        base: registry.base?.name,
        customer: registry.customer?.name,
        generatedAt: new Date().toISOString(),
      },
      data: registry.registryData,
      totals: registry.totals,
    };

    return exportData;
  }

    await db
      .update(registryTemplates)
      .set({
        deletedAt: sql`NOW()`,
        deletedById: userId,
      })
      .where(eq(registryTemplates.id, id));

    return true;
  }
}
