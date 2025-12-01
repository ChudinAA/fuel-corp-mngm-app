import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import session from "express-session";
import { storage } from "./storage";
import {
  loginSchema,
  insertUserSchema,
  insertRoleSchema,
  insertDirectoryWholesaleSchema,
  insertDirectoryRefuelingSchema,
  insertDirectoryLogisticsSchema,
  insertPriceSchema,
  insertDeliveryCostSchema,
  insertWarehouseSchema,
  insertExchangeSchema,
  insertMovementSchema,
  insertOptSchema,
  insertAircraftRefuelingSchema,
  DEFAULT_ROLES,
  MODULES,
  ACTIONS,
} from "@shared/schema";
import { z } from "zod";

declare module "express-session" {
  interface SessionData {
    userId: number;
  }
}

function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.session.userId) {
    return res.status(401).json({ message: "Необходима авторизация" });
  }
  next();
}

function requirePermission(module: string, action: string) {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Необходима авторизация" });
    }

    try {
      const user = await storage.getUser(req.session.userId);
      if (!user) {
        return res.status(401).json({ message: "Пользователь не найден" });
      }

      if (!user.roleId) {
        return res.status(403).json({ message: "Нет назначенной роли" });
      }

      const role = await storage.getRole(user.roleId);
      if (!role) {
        return res.status(403).json({ message: "Роль не найдена" });
      }

      const requiredPermission = `${module}.${action}`;
      const hasPermission = role.permissions?.includes(requiredPermission);

      if (role.name === "Админ" || role.name === "Ген.дир") {
        return next();
      }

      if (!hasPermission) {
        return res.status(403).json({ message: "Недостаточно прав для выполнения операции" });
      }

      next();
    } catch (error) {
      res.status(500).json({ message: "Ошибка проверки прав" });
    }
  };
}

async function seedDefaultRoles() {
  try {
    const existingRoles = await storage.getAllRoles();
    if (existingRoles.length === 0) {
      console.log("Seeding default roles...");

      for (const roleData of DEFAULT_ROLES) {
        let permissions: string[] = [];
        
        if (roleData.name === "Ген.дир" || roleData.name === "Админ") {
          permissions = MODULES.flatMap(m => ACTIONS.map(a => `${m}.${a}`));
        } else if (roleData.name === "Глав.бух" || roleData.name === "Коммерческий директор") {
          permissions = MODULES.filter(m => m !== "admin").flatMap(m => ACTIONS.map(a => `${m}.${a}`));
        } else if (roleData.name === "Руководитель проекта" || roleData.name === "Ведущий менеджер") {
          permissions = MODULES.filter(m => m !== "admin").flatMap(m => ["view", "create", "edit"].map(a => `${m}.${a}`));
        } else if (roleData.name === "Руководитель подразделения" || roleData.name === "Менеджер") {
          permissions = ["opt", "refueling", "exchange", "warehouses", "prices", "directories"].flatMap(m => ["view", "create", "edit"].map(a => `${m}.${a}`));
        } else if (roleData.name === "Операционист" || roleData.name === "Оператор подразделения") {
          permissions = ["opt", "refueling", "warehouses", "directories"].flatMap(m => ["view", "create"].map(a => `${m}.${a}`));
        }

        await storage.createRole({
          name: roleData.name,
          description: roleData.description,
          permissions,
          isDefault: roleData.name === "Менеджер",
          isSystem: roleData.name === "Админ" || roleData.name === "Ген.дир",
        });
      }
      console.log("Default roles seeded successfully");
    }
  } catch (error) {
    console.error("Error seeding default roles:", error);
  }
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // Session configuration
  app.use(
    session({
      secret: process.env.SESSION_SECRET || "aviation-fuel-secret-key",
      resave: false,
      saveUninitialized: false,
      cookie: {
        secure: process.env.NODE_ENV === "production",
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000, // 24 hours
      },
    })
  );

  // Seed default roles on startup
  await seedDefaultRoles();

  // ============ AUTH ROUTES ============

  // Register
  app.post("/api/auth/register", async (req, res) => {
    try {
      const registerSchema = insertUserSchema.extend({
        confirmPassword: z.string().optional(),
      });
      const data = registerSchema.parse(req.body);
      
      // Check if email already exists
      const existingUser = await storage.getUserByEmail(data.email);
      if (existingUser) {
        return res.status(400).json({ message: "Пользователь с таким email уже существует" });
      }

      // Get default role for new users
      const roles = await storage.getAllRoles();
      const defaultRole = roles.find(r => r.isDefault) || roles.find(r => r.name === "Менеджер");
      
      // If this is the first user, make them admin
      const allUsers = await storage.getAllUsers();
      const adminRole = roles.find(r => r.name === "Админ");
      const roleToAssign = allUsers.length === 0 && adminRole ? adminRole : defaultRole;

      const user = await storage.createUser({
        ...data,
        roleId: roleToAssign?.id || null,
      });
      req.session.userId = user.id;
      
      // Return user without password
      const { password, ...safeUser } = user;
      res.status(201).json(safeUser);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors[0].message });
      }
      res.status(500).json({ message: "Ошибка регистрации" });
    }
  });

  // Login
  app.post("/api/auth/login", async (req, res) => {
    try {
      const { email, password } = loginSchema.parse(req.body);
      
      const user = await storage.verifyUserPassword(email, password);
      if (!user) {
        return res.status(401).json({ message: "Неверный email или пароль" });
      }

      if (!user.isActive) {
        return res.status(403).json({ message: "Аккаунт заблокирован" });
      }

      await storage.updateLastLogin(user.id);
      req.session.userId = user.id;
      
      const { password: _, ...safeUser } = user;
      res.json(safeUser);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors[0].message });
      }
      res.status(500).json({ message: "Ошибка входа" });
    }
  });

  // Logout
  app.post("/api/auth/logout", (req, res) => {
    req.session.destroy((err) => {
      if (err) {
        return res.status(500).json({ message: "Ошибка выхода" });
      }
      res.json({ message: "Выход выполнен успешно" });
    });
  });

  // Get current user
  app.get("/api/auth/user", async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Не авторизован" });
    }

    const user = await storage.getUser(req.session.userId);
    if (!user) {
      return res.status(404).json({ message: "Пользователь не найден" });
    }

    const { password, ...safeUser } = user;
    res.json(safeUser);
  });

  // ============ ROLES ROUTES ============

  app.get("/api/roles", requireAuth, async (req, res) => {
    const roles = await storage.getAllRoles();
    res.json(roles);
  });

  app.post("/api/roles", requirePermission("admin", "create"), async (req, res) => {
    try {
      const data = insertRoleSchema.parse(req.body);
      const role = await storage.createRole(data);
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
      const role = await storage.updateRole(id, req.body);
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
      await storage.deleteRole(id);
      res.json({ message: "Роль удалена" });
    } catch (error) {
      res.status(500).json({ message: "Ошибка удаления роли" });
    }
  });

  // ============ ADMIN USERS ROUTES ============

  app.get("/api/admin/users", requirePermission("admin", "view"), async (req, res) => {
    const users = await storage.getAllUsers();
    const safeUsers = users.map(({ password, ...user }) => user);
    res.json(safeUsers);
  });

  app.post("/api/admin/users", requirePermission("admin", "create"), async (req, res) => {
    try {
      const data = insertUserSchema.parse(req.body);
      const existingUser = await storage.getUserByEmail(data.email);
      if (existingUser) {
        return res.status(400).json({ message: "Пользователь с таким email уже существует" });
      }
      const user = await storage.createUser(data);
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
      const user = await storage.updateUser(id, req.body);
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
      await storage.deleteUser(id);
      res.json({ message: "Пользователь удален" });
    } catch (error) {
      res.status(500).json({ message: "Ошибка удаления пользователя" });
    }
  });

  // ============ DIRECTORIES ROUTES ============

  // Wholesale
  app.get("/api/directories/wholesale", requireAuth, async (req, res) => {
    const type = req.query.type as string | undefined;
    const data = await storage.getDirectoryWholesale(type);
    res.json(data);
  });

  app.get("/api/directories/wholesale/:type", requireAuth, async (req, res) => {
    const data = await storage.getDirectoryWholesale(req.params.type);
    res.json(data);
  });

  app.post("/api/directories/wholesale", requireAuth, async (req, res) => {
    try {
      const data = insertDirectoryWholesaleSchema.parse(req.body);
      const item = await storage.createDirectoryWholesale(data);
      res.status(201).json(item);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors[0].message });
      }
      res.status(500).json({ message: "Ошибка создания записи" });
    }
  });

  app.patch("/api/directories/wholesale/:id", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const item = await storage.updateDirectoryWholesale(id, req.body);
      if (!item) {
        return res.status(404).json({ message: "Запись не найдена" });
      }
      res.json(item);
    } catch (error) {
      res.status(500).json({ message: "Ошибка обновления записи" });
    }
  });

  app.delete("/api/directories/wholesale/:id", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteDirectoryWholesale(id);
      res.json({ message: "Запись удалена" });
    } catch (error) {
      res.status(500).json({ message: "Ошибка удаления записи" });
    }
  });

  // Refueling
  app.get("/api/directories/refueling", requireAuth, async (req, res) => {
    const type = req.query.type as string | undefined;
    const data = await storage.getDirectoryRefueling(type);
    res.json(data);
  });

  app.get("/api/directories/refueling/:type", requireAuth, async (req, res) => {
    const data = await storage.getDirectoryRefueling(req.params.type);
    res.json(data);
  });

  app.post("/api/directories/refueling", requireAuth, async (req, res) => {
    try {
      const data = insertDirectoryRefuelingSchema.parse(req.body);
      const item = await storage.createDirectoryRefueling(data);
      res.status(201).json(item);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors[0].message });
      }
      res.status(500).json({ message: "Ошибка создания записи" });
    }
  });

  app.patch("/api/directories/refueling/:id", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const item = await storage.updateDirectoryRefueling(id, req.body);
      if (!item) {
        return res.status(404).json({ message: "Запись не найдена" });
      }
      res.json(item);
    } catch (error) {
      res.status(500).json({ message: "Ошибка обновления записи" });
    }
  });

  app.delete("/api/directories/refueling/:id", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteDirectoryRefueling(id);
      res.json({ message: "Запись удалена" });
    } catch (error) {
      res.status(500).json({ message: "Ошибка удаления записи" });
    }
  });

  // Logistics
  app.get("/api/directories/logistics", requireAuth, async (req, res) => {
    const type = req.query.type as string | undefined;
    const data = await storage.getDirectoryLogistics(type);
    res.json(data);
  });

  app.get("/api/directories/logistics/:type", requireAuth, async (req, res) => {
    const data = await storage.getDirectoryLogistics(req.params.type);
    res.json(data);
  });

  app.post("/api/directories/logistics", requireAuth, async (req, res) => {
    try {
      const data = insertDirectoryLogisticsSchema.parse(req.body);
      const item = await storage.createDirectoryLogistics(data);
      res.status(201).json(item);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors[0].message });
      }
      res.status(500).json({ message: "Ошибка создания записи" });
    }
  });

  app.patch("/api/directories/logistics/:id", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const item = await storage.updateDirectoryLogistics(id, req.body);
      if (!item) {
        return res.status(404).json({ message: "Запись не найдена" });
      }
      res.json(item);
    } catch (error) {
      res.status(500).json({ message: "Ошибка обновления записи" });
    }
  });

  app.delete("/api/directories/logistics/:id", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteDirectoryLogistics(id);
      res.json({ message: "Запись удалена" });
    } catch (error) {
      res.status(500).json({ message: "Ошибка удаления записи" });
    }
  });

  // ============ PRICES ROUTES ============

  app.get("/api/prices", requireAuth, async (req, res) => {
    const { priceType, counterpartyType } = req.query;
    if (priceType && counterpartyType) {
      const data = await storage.getPricesByType(priceType as string, counterpartyType as string);
      return res.json(data);
    }
    const data = await storage.getAllPrices();
    res.json(data);
  });

  app.post("/api/prices", requireAuth, async (req, res) => {
    try {
      const data = insertPriceSchema.parse(req.body);
      const item = await storage.createPrice(data);
      res.status(201).json(item);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors[0].message });
      }
      res.status(500).json({ message: "Ошибка создания цены" });
    }
  });

  app.patch("/api/prices/:id", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const item = await storage.updatePrice(id, req.body);
      if (!item) {
        return res.status(404).json({ message: "Цена не найдена" });
      }
      res.json(item);
    } catch (error) {
      res.status(500).json({ message: "Ошибка обновления цены" });
    }
  });

  app.delete("/api/prices/:id", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deletePrice(id);
      res.json({ message: "Цена удалена" });
    } catch (error) {
      res.status(500).json({ message: "Ошибка удаления цены" });
    }
  });

  // ============ DELIVERY COST ROUTES ============

  app.get("/api/delivery-costs", requireAuth, async (req, res) => {
    const data = await storage.getAllDeliveryCosts();
    res.json(data);
  });

  app.post("/api/delivery-costs", requireAuth, async (req, res) => {
    try {
      const data = insertDeliveryCostSchema.parse(req.body);
      const item = await storage.createDeliveryCost(data);
      res.status(201).json(item);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors[0].message });
      }
      res.status(500).json({ message: "Ошибка создания тарифа" });
    }
  });

  app.patch("/api/delivery-costs/:id", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const item = await storage.updateDeliveryCost(id, req.body);
      if (!item) {
        return res.status(404).json({ message: "Тариф не найден" });
      }
      res.json(item);
    } catch (error) {
      res.status(500).json({ message: "Ошибка обновления тарифа" });
    }
  });

  app.delete("/api/delivery-costs/:id", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteDeliveryCost(id);
      res.json({ message: "Тариф удален" });
    } catch (error) {
      res.status(500).json({ message: "Ошибка удаления тарифа" });
    }
  });

  // ============ WAREHOUSES ROUTES ============

  app.get("/api/warehouses", requireAuth, async (req, res) => {
    const data = await storage.getAllWarehouses();
    res.json(data);
  });

  app.get("/api/warehouses/:id", requireAuth, async (req, res) => {
    const id = parseInt(req.params.id);
    const warehouse = await storage.getWarehouse(id);
    if (!warehouse) {
      return res.status(404).json({ message: "Склад не найден" });
    }
    res.json(warehouse);
  });

  app.post("/api/warehouses", requireAuth, async (req, res) => {
    try {
      const data = insertWarehouseSchema.parse(req.body);
      const item = await storage.createWarehouse(data);
      res.status(201).json(item);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors[0].message });
      }
      res.status(500).json({ message: "Ошибка создания склада" });
    }
  });

  app.patch("/api/warehouses/:id", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const item = await storage.updateWarehouse(id, req.body);
      if (!item) {
        return res.status(404).json({ message: "Склад не найден" });
      }
      res.json(item);
    } catch (error) {
      res.status(500).json({ message: "Ошибка обновления склада" });
    }
  });

  app.delete("/api/warehouses/:id", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteWarehouse(id);
      res.json({ message: "Склад удален" });
    } catch (error) {
      res.status(500).json({ message: "Ошибка удаления склада" });
    }
  });

  // ============ EXCHANGE ROUTES ============

  app.get("/api/exchange", requireAuth, async (req, res) => {
    const page = parseInt(req.query.page as string) || 1;
    const pageSize = parseInt(req.query.pageSize as string) || 10;
    const result = await storage.getExchangeDeals(page, pageSize);
    res.json(result);
  });

  app.post("/api/exchange", requireAuth, async (req, res) => {
    try {
      const data = insertExchangeSchema.parse({
        ...req.body,
        createdById: req.session.userId,
      });
      const item = await storage.createExchange(data);
      res.status(201).json(item);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors[0].message });
      }
      res.status(500).json({ message: "Ошибка создания сделки" });
    }
  });

  app.patch("/api/exchange/:id", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const item = await storage.updateExchange(id, req.body);
      if (!item) {
        return res.status(404).json({ message: "Сделка не найдена" });
      }
      res.json(item);
    } catch (error) {
      res.status(500).json({ message: "Ошибка обновления сделки" });
    }
  });

  app.delete("/api/exchange/:id", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteExchange(id);
      res.json({ message: "Сделка удалена" });
    } catch (error) {
      res.status(500).json({ message: "Ошибка удаления сделки" });
    }
  });

  // ============ MOVEMENT ROUTES ============

  app.get("/api/movement", requireAuth, async (req, res) => {
    const page = parseInt(req.query.page as string) || 1;
    const pageSize = parseInt(req.query.pageSize as string) || 10;
    const result = await storage.getMovements(page, pageSize);
    res.json(result);
  });

  app.post("/api/movement", requireAuth, async (req, res) => {
    try {
      const data = insertMovementSchema.parse({
        ...req.body,
        createdById: req.session.userId,
      });
      const item = await storage.createMovement(data);
      res.status(201).json(item);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors[0].message });
      }
      res.status(500).json({ message: "Ошибка создания перемещения" });
    }
  });

  app.patch("/api/movement/:id", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const item = await storage.updateMovement(id, req.body);
      if (!item) {
        return res.status(404).json({ message: "Перемещение не найдено" });
      }
      res.json(item);
    } catch (error) {
      res.status(500).json({ message: "Ошибка обновления перемещения" });
    }
  });

  app.delete("/api/movement/:id", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteMovement(id);
      res.json({ message: "Перемещение удалено" });
    } catch (error) {
      res.status(500).json({ message: "Ошибка удаления перемещения" });
    }
  });

  // ============ OPT ROUTES ============

  app.get("/api/opt", requireAuth, async (req, res) => {
    const page = parseInt(req.query.page as string) || 1;
    const pageSize = parseInt(req.query.pageSize as string) || 10;
    const result = await storage.getOptDeals(page, pageSize);
    res.json(result);
  });

  app.post("/api/opt", requireAuth, async (req, res) => {
    try {
      const data = insertOptSchema.parse({
        ...req.body,
        createdById: req.session.userId,
        warehouseStatus: "OK",
        priceStatus: "OK",
      });
      const item = await storage.createOpt(data);
      res.status(201).json(item);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors[0].message });
      }
      res.status(500).json({ message: "Ошибка создания сделки" });
    }
  });

  app.patch("/api/opt/:id", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const item = await storage.updateOpt(id, req.body);
      if (!item) {
        return res.status(404).json({ message: "Сделка не найдена" });
      }
      res.json(item);
    } catch (error) {
      res.status(500).json({ message: "Ошибка обновления сделки" });
    }
  });

  app.delete("/api/opt/:id", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteOpt(id);
      res.json({ message: "Сделка удалена" });
    } catch (error) {
      res.status(500).json({ message: "Ошибка удаления сделки" });
    }
  });

  // ============ REFUELING ROUTES ============

  app.get("/api/refueling", requireAuth, async (req, res) => {
    const page = parseInt(req.query.page as string) || 1;
    const pageSize = parseInt(req.query.pageSize as string) || 10;
    const result = await storage.getRefuelings(page, pageSize);
    res.json(result);
  });

  app.post("/api/refueling", requireAuth, async (req, res) => {
    try {
      const data = insertAircraftRefuelingSchema.parse({
        ...req.body,
        createdById: req.session.userId,
        warehouseStatus: "OK",
        priceStatus: "OK",
      });
      const item = await storage.createRefueling(data);
      res.status(201).json(item);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors[0].message });
      }
      res.status(500).json({ message: "Ошибка создания заправки" });
    }
  });

  app.patch("/api/refueling/:id", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const item = await storage.updateRefueling(id, req.body);
      if (!item) {
        return res.status(404).json({ message: "Заправка не найдена" });
      }
      res.json(item);
    } catch (error) {
      res.status(500).json({ message: "Ошибка обновления заправки" });
    }
  });

  app.delete("/api/refueling/:id", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteRefueling(id);
      res.json({ message: "Заправка удалена" });
    } catch (error) {
      res.status(500).json({ message: "Ошибка удаления заправки" });
    }
  });

  // ============ DASHBOARD ROUTES ============

  app.get("/api/dashboard/stats", requireAuth, async (req, res) => {
    const stats = await storage.getDashboardStats();
    res.json(stats);
  });

  return httpServer;
}
