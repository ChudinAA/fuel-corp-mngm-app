import type { Express } from "express";
import { storage } from "../storage/index";
import { loginSchema, registerUserSchema } from "@shared/schema";
import { z } from "zod";

export function registerAuthRoutes(app: Express) {
  app.post("/api/auth/register", async (req, res) => {
    try {
      const data = registerUserSchema.parse(req.body);
      const { email, password, firstName, lastName } = data;

      const existingUser = await storage.users.getUserByEmail(email);
      if (existingUser) {
        return res.status(400).json({ message: "Пользователь с таким email уже существует" });
      }

      const roles = await storage.roles.getAllRoles();
      const defaultRole = roles.find(r => r.isDefault) || roles.find(r => r.name === "Менеджер");

      const allUsers = await storage.users.getAllUsers();
      const adminRole = roles.find(r => r.name === "Админ");
      const roleToAssign = allUsers.length === 0 && adminRole ? adminRole : defaultRole;

      const { confirmPassword, ...userData } = data;

      const user = await storage.users.createUser({
        ...userData,
        roleId: roleToAssign?.id || null,
        isActive: true,
      });
      req.session.userId = user.id;

      const { password: _, ...safeUser } = user;
      res.status(201).json({ ...safeUser, role: roleToAssign || null });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors[0].message });
      }
      res.status(500).json({ message: "Ошибка регистрации" });
    }
  });

  app.post("/api/auth/login", async (req, res) => {
    try {
      const { email, password } = loginSchema.parse(req.body);

      const user = await storage.users.verifyUserPassword(email, password);
      if (!user) {
        return res.status(401).json({ message: "Неверные учетные данные" });
      }

      if (!user.isActive) {
        return res.status(403).json({ message: "Аккаунт заблокирован" });
      }

      await storage.users.updateLastLogin(user.id);
      req.session!.userId = user.id;

      let role = null;
      if (user.roleId) {
        role = await storage.roles.getRole(user.roleId);
      }

      const { password: _, ...safeUser } = user;
      res.json({ ...safeUser, role });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors[0].message });
      }
      res.status(500).json({ message: "Ошибка входа" });
    }
  });

  app.post("/api/auth/logout", (req, res) => {
    req.session.destroy((err) => {
      if (err) {
        return res.status(500).json({ message: "Ошибка выхода" });
      }
      res.json({ message: "Выход выполнен успешно" });
    });
  });

  app.get("/api/auth/user", async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Не авторизован" });
    }

    const user = await storage.users.getUser(req.session.userId);
    if (!user) {
      return res.status(404).json({ message: "Пользователь не найден" });
    }

    let role = null;
    if (user.roleId) {
      role = await storage.roles.getRole(user.roleId);
    }

    const { password: _, ...safeUser } = user;
    res.json({ ...safeUser, role });
  });
}