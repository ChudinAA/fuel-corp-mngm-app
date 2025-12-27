import { eq, asc, isNull } from "drizzle-orm";
import { db } from "server/db";
import { roles, type Role, type InsertRole } from "@shared/schema";
import { sql } from "drizzle-orm";
import type { IRoleStorage } from "../../../storage/types";

export class RoleStorage implements IRoleStorage {
  async getRole(id: string): Promise<Role | undefined> {
    const [role] = await db
      .select()
      .from(roles)
      .where(eq(roles.id, id))
      .where(isNull(roles.deletedAt))
      .limit(1);
    return role;
  }

  async getAllRoles(): Promise<Role[]> {
    return db.select().from(roles).where(isNull(roles.deletedAt)).orderBy(asc(roles.name));
  }

  async createRole(role: InsertRole): Promise<Role> {
    const [created] = await db.insert(roles).values(role).returning();
    return created;
  }

  async updateRole(
    id: string,
    data: Partial<InsertRole>
  ): Promise<Role | undefined> {
    const [updated] = await db
      .update(roles)
      .set(data)
      .where(eq(roles.id, id))
      .returning();
    return updated;
  }

  async deleteRole(id: string, deletedById?: string): Promise<boolean> {
    await db.update(roles).set({
      deletedAt: sql`NOW()`,
      deletedById: deletedById,
    }).where(eq(roles.id, id));
    return true;
  }
}
