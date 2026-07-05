import { storage } from "../../../storage/index";
import { DEFAULT_ROLES, MODULES, ACTIONS } from "@shared/schema";

const PLANNING_ALLOCATE_ROLES = [
  "Ген.дир",
  "Админ",
  "Коммерческий директор",
  "Руководитель подразделения",
];

export async function ensurePlanningAllocatePermission() {
  try {
    const roles = await storage.roles.getAllRoles();
    for (const role of roles) {
      if (!PLANNING_ALLOCATE_ROLES.includes(role.name)) continue;
      const permissions = role.permissions || [];
      if (!permissions.includes("planning.allocate")) {
        await storage.roles.updateRole(role.id, {
          permissions: [...permissions, "planning.allocate"],
        });
      }
    }
  } catch (error) {
    console.error("Error ensuring planning.allocate permission:", error);
  }
}

export async function seedDefaultRoles() {
  try {
    const existingRoles = await storage.roles.getAllRoles();
    if (existingRoles.length === 0) {
      console.log("Seeding default roles...");

      for (const roleData of DEFAULT_ROLES) {
        let permissions: string[] = [];

        if (roleData.name === "Ген.дир" || roleData.name === "Админ") {
          permissions = MODULES.flatMap((m) => ACTIONS.map((a) => `${m}.${a}`));
        } else if (
          roleData.name === "Глав.бух" ||
          roleData.name === "Коммерческий директор"
        ) {
          permissions = MODULES.filter((m) => m !== "admin").flatMap((m) =>
            ACTIONS.map((a) => `${m}.${a}`)
          );
        } else if (
          roleData.name === "Руководитель проекта" ||
          roleData.name === "Ведущий менеджер"
        ) {
          permissions = MODULES.filter((m) => m !== "admin").flatMap((m) =>
            ["view", "create", "edit"].map((a) => `${m}.${a}`)
          );
        } else if (
          roleData.name === "Руководитель подразделения" ||
          roleData.name === "Менеджер"
        ) {
          permissions = [
            "opt",
            "refueling",
            "exchange",
            "warehouses",
            "prices",
            "directories",
            "planning",
          ].flatMap((m) => ["view", "create", "edit"].map((a) => `${m}.${a}`));
        } else if (
          roleData.name === "Операционист" ||
          roleData.name === "Оператор подразделения"
        ) {
          permissions = [
            "opt",
            "refueling",
            "warehouses",
            "directories",
          ].flatMap((m) => ["view", "create"].map((a) => `${m}.${a}`));
        }

        if (
          PLANNING_ALLOCATE_ROLES.includes(roleData.name) &&
          !permissions.includes("planning.allocate")
        ) {
          permissions = [...permissions, "planning.allocate"];
        }

        await storage.roles.createRole({
          name: roleData.name,
          description: roleData.description,
          permissions,
          isDefault: roleData.name === "Менеджер",
          isSystem: roleData.name === "Админ" || roleData.name === "Ген.дир",
          createdById: null,
        });
      }
      console.log("Default roles seeded successfully");
    }
  } catch (error) {
    console.error("Error seeding default roles:", error);
  }
}
