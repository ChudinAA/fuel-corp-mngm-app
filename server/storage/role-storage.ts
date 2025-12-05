
import { eq, asc } from "drizzle-orm";
import { db } from "../db";
import { roles, type Role, type InsertRole } from "@shared/schema";
import type { IRoleStorage } from "./types";

export class RoleStorage implements IRoleStorage {
  async getRole(id: string): Promise<Role | undefined> {
    const [role] = await db.select().from(roles).where(eq(roles.id, id)).limit(1);
    return role;
  }

  async getAllRoles(): Promise<Role[]> {
    return db.select().from(roles).orderBy(asc(roles.name));
  }

  async createRole(role: InsertRole): Promise<Role> {
    const [created] = await db.insert(roles).values(role).returning();
    return created;
  }

  async updateRole(id: string, data: Partial<InsertRole>): Promise<Role | undefined> {
    const [updated] = await db.update(roles).set(data).where(eq(roles.id, id)).returning();
    return updated;
  }

  async deleteRole(id: string): Promise<boolean> {
    await db.delete(roles).where(eq(roles.id, id));
    return true;
  }
}
