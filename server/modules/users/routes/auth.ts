import type { Express } from "express";
import { storage } from "../../../storage/index";
import { loginSchema, registerUserSchema } from "@shared/schema";
import { z } from "zod";

const updateProfileSchema = z.object({
  firstName: z.string().min(1, "Имя обязательно").optional(),
  lastName: z.string().min(1, "Фамилия обязательна").optional(),
  email: z.string().email("Некорректный email").optional(),
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Введите текущий пароль"),
  newPassword: z.string().min(6, "Пароль должен быть не менее 6 символов"),
  confirmPassword: z.string().min(1, "Подтвердите пароль"),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "Пароли не совпадают",
  path: ["confirmPassword"],
});

export function registerAuthRoutes(app: Express) {
  app.post("/api/auth/register", async (req, res) => {
    try {
      const data = registerUserSchema.parse(req.body);
      const { email, password, firstName, lastName } = data;

      const existingUser = await storage.users.getUserByEmail(email);
      if (existingUser) {
        return res
          .status(400)
          .json({ message: "Пользователь с таким email уже существует" });
      }

      const roles = await storage.roles.getAllRoles();
      const defaultRole =
        roles.find((r) => r.isDefault) ||
        roles.find((r) => r.name === "Менеджер");

      const allUsers = await storage.users.getAllUsers();
      const adminRole = roles.find((r) => r.name === "Админ");
      const roleToAssign =
        allUsers.length === 0 && adminRole ? adminRole : defaultRole;

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

  app.patch("/api/auth/profile", async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Не авторизован" });
    }

    try {
      const data = updateProfileSchema.parse(req.body);

      if (data.email) {
        const existing = await storage.users.getUserByEmail(data.email);
        if (existing && existing.id !== req.session.userId) {
          return res.status(400).json({ message: "Этот email уже используется другим пользователем" });
        }
      }

      const updated = await storage.users.updateUser(req.session.userId, data, req.session.userId);
      if (!updated) {
        return res.status(404).json({ message: "Пользователь не найден" });
      }

      let role = null;
      if (updated.roleId) {
        role = await storage.roles.getRole(updated.roleId);
      }

      const { password: _, ...safeUser } = updated;
      res.json({ ...safeUser, role });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors[0].message });
      }
      res.status(500).json({ message: "Ошибка обновления профиля" });
    }
  });

  app.patch("/api/auth/change-password", async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Не авторизован" });
    }

    try {
      const { currentPassword, newPassword } = changePasswordSchema.parse(req.body);

      const user = await storage.users.getUser(req.session.userId);
      if (!user) {
        return res.status(404).json({ message: "Пользователь не найден" });
      }

      const isValid = await storage.users.verifyUserPassword(user.email, currentPassword);
      if (!isValid) {
        return res.status(400).json({ message: "Текущий пароль неверен" });
      }

      await storage.users.updateUser(req.session.userId, { password: newPassword }, req.session.userId);

      res.json({ message: "Пароль успешно изменён" });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors[0].message });
      }
      res.status(500).json({ message: "Ошибка смены пароля" });
    }
  });
}
