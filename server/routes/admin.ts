import type { Express } from "express";
import { storage } from "../storage/index";
import { insertUserSchema, insertRoleSchema } from "@shared/schema";
import { z } from "zod";
import { requirePermission } from "./middleware";

export function registerAdminRoutes(app: Express) {
  // ============ ROLES ROUTES ============

  app.get("/api/roles", async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Необходима авторизация" });
    }
    const roles = await storage.roles.getAllRoles();
    res.json(roles);
  });

  app.post("/api/roles", requirePermission("admin", "create"), async (req, res) => {
    try {
      const data = insertRoleSchema.parse(req.body);
      const role = await storage.roles.createRole(data);
      res.status(201).json(role);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors[0].message });
      }
      res.status(500).json({ message: "Ошибка создания роли" });
    }
  });

  app.patch("/api/roles/:id", requirePermission("admin", "edit"), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const role = await storage.roles.updateRole(id, req.body);
      if (!role) {
        return res.status(404).json({ message: "Роль не найдена" });
      }
      res.json(role);
    } catch (error) {
      res.status(500).json({ message: "Ошибка обновления роли" });
    }
  });

  app.delete("/api/roles/:id", requirePermission("admin", "delete"), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.roles.deleteRole(id);
      res.json({ message: "Роль удалена" });
    } catch (error) {
      res.status(500).json({ message: "Ошибка удаления роли" });
    }
  });

  // ============ ADMIN USERS ROUTES ============

  app.get("/api/admin/users", requirePermission("admin", "view"), async (req, res) => {
    const users = await storage.users.getAllUsers();
    const safeUsers = users.map(({ password, ...user }) => user);
    res.json(safeUsers);
  });

  app.post("/api/admin/users", requirePermission("admin", "create"), async (req, res) => {
    try {
      const data = insertUserSchema.parse(req.body);
      const existingUser = await storage.users.getUserByEmail(data.email);
      if (existingUser) {
        return res.status(400).json({ message: "Пользователь с таким email уже существует" });
      }
      const user = await storage.users.createUser(data);
      const { password, ...safeUser } = user;
      res.status(201).json(safeUser);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors[0].message });
      }
      res.status(500).json({ message: "Ошибка создания пользователя" });
    }
  });

  app.patch("/api/admin/users/:id", requirePermission("admin", "edit"), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const user = await storage.users.updateUser(id, req.body);
      if (!user) {
        return res.status(404).json({ message: "Пользователь не найден" });
      }
      const { password, ...safeUser } = user;
      res.json(safeUser);
    } catch (error) {
      res.status(500).json({ message: "Ошибка обновления пользователя" });
    }
  });

  app.delete("/api/admin/users/:id", requirePermission("admin", "delete"), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.users.deleteUser(id);
      res.json({ message: "Пользователь удален" });
    } catch (error) {
      res.status(500).json({ message: "Ошибка удаления пользователя" });
    }
  });
}