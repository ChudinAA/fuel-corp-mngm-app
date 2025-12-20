import type { Request, Response, NextFunction } from "express";
import { storage } from "../storage/index";

declare module "express-session" {
  interface SessionData {
    userId: number;
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.session.userId) {
    return res.status(401).json({ message: "Необходима авторизация" });
  }
  next();
}

export function requirePermission(module: string, action: string) {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Необходима авторизация" });
    }

    try {
      const user = await storage.users.getUser(req.session.userId);
      if (!user) {
        return res.status(401).json({ message: "Пользователь не найден" });
      }

      if (!user.roleId) {
        return res.status(403).json({ message: "Нет назначенной роли" });
      }

      const role = await storage.roles.getRole(user.roleId);
      if (!role) {
        return res.status(403).json({ message: "Роль не найдена" });
      }

      const requiredPermission = `${module}.${action}`;
      const hasPermission = role.permissions?.includes(requiredPermission);

      if (role.name === "Админ" || role.name === "Ген.дир") {
        return next();
      }

      if (!hasPermission) {
        return res.status(403).json({ message: "Недостаточно прав доступа" });
      }

      next();
    } catch (error) {
      return res.status(500).json({ message: "Ошибка проверки прав доступа" });
    }
  };
}