import { eq, desc, sql, and, isNull, gte, lte } from "drizzle-orm";
import { db } from "server/db";
import { registryTemplates, type RegistryTemplate, type InsertRegistryTemplate } from "../entities/registries";
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
    await db
      .update(registryTemplates)
      .set({
        deletedAt: sql`NOW()`,
        deletedById: userId,
      })
      .where(eq(registryTemplates.id, id));

    return true;
  }

  async getRegistriesByTemplate(
    templateType: string,
    filters?: {
      startDate?: string;
      endDate?: string;
      baseId?: string;
      customerId?: string;
    }
  ): Promise<any> {
    // TODO: Implement when registries table is created
    return [];
  }

  async prepareRegistryForExport(id: string): Promise<any> {
    // TODO: Implement when registries table is created
    throw new Error("Registry export not implemented yet");
  }
}