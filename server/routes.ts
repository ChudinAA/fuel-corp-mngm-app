import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import session from "express-session";
import { storage } from "./storage";
import {
  loginSchema,
  registerUserSchema,
  insertUserSchema,
  insertRoleSchema,
  insertCustomerSchema,
  insertWholesaleSupplierSchema,
  insertWholesaleBaseSchema,
  insertRefuelingProviderSchema,
  insertRefuelingBaseSchema,
  insertLogisticsCarrierSchema,
  insertLogisticsDeliveryLocationSchema,
  insertLogisticsVehicleSchema,
  insertLogisticsTrailerSchema,
  insertLogisticsDriverSchema,
  insertLogisticsWarehouseSchema,
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
  app.use(
    session({
      secret: process.env.SESSION_SECRET || "aviation-fuel-secret-key",
      resave: false,
      saveUninitialized: false,
      cookie: {
        secure: process.env.NODE_ENV === "production",
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000,
      },
    })
  );

  await seedDefaultRoles();

  // ============ AUTH ROUTES ============

  app.post("/api/auth/register", async (req, res) => {
    try {
      const data = registerUserSchema.parse(req.body);
      
      const existingUser = await storage.getUserByEmail(data.email);
      if (existingUser) {
        return res.status(400).json({ message: "Пользователь с таким email уже существует" });
      }

      const roles = await storage.getAllRoles();
      const defaultRole = roles.find(r => r.isDefault) || roles.find(r => r.name === "Менеджер");
      
      const allUsers = await storage.getAllUsers();
      const adminRole = roles.find(r => r.name === "Админ");
      const roleToAssign = allUsers.length === 0 && adminRole ? adminRole : defaultRole;

      const { confirmPassword, ...userData } = data;
      
      const user = await storage.createUser({
        ...userData,
        roleId: roleToAssign?.id || null,
        isActive: true,
      });
      req.session.userId = user.id;
      
      const { password, ...safeUser } = user;
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
      
      const user = await storage.verifyUserPassword(email, password);
      if (!user) {
        return res.status(401).json({ message: "Неверный email или пароль" });
      }

      if (!user.isActive) {
        return res.status(403).json({ message: "Аккаунт заблокирован" });
      }

      await storage.updateLastLogin(user.id);
      req.session.userId = user.id;
      
      let role = null;
      if (user.roleId) {
        role = await storage.getRole(user.roleId);
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

    const user = await storage.getUser(req.session.userId);
    if (!user) {
      return res.status(404).json({ message: "Пользователь не найден" });
    }

    let role = null;
    if (user.roleId) {
      role = await storage.getRole(user.roleId);
    }

    const { password, ...safeUser } = user;
    res.json({ ...safeUser, role });
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

  // ============ CUSTOMERS (Unified for Wholesale and Refueling) ============

  app.get("/api/customers", requireAuth, async (req, res) => {
    const module = req.query.module as string | undefined;
    const data = await storage.getAllCustomers(module);
    res.json(data);
  });

  app.get("/api/customers/:id", requireAuth, async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ message: "Неверный идентификатор" });
    }
    const customer = await storage.getCustomer(id);
    if (!customer) {
      return res.status(404).json({ message: "Покупатель не найден" });
    }
    res.json(customer);
  });

  app.post("/api/customers", requireAuth, async (req, res) => {
    try {
      const data = insertCustomerSchema.parse(req.body);
      const item = await storage.createCustomer(data);
      res.status(201).json(item);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors[0].message });
      }
      res.status(500).json({ message: "Ошибка создания покупателя" });
    }
  });

  app.patch("/api/customers/:id", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Неверный идентификатор" });
      }
      const item = await storage.updateCustomer(id, req.body);
      if (!item) {
        return res.status(404).json({ message: "Покупатель не найден" });
      }
      res.json(item);
    } catch (error) {
      res.status(500).json({ message: "Ошибка обновления покупателя" });
    }
  });

  app.delete("/api/customers/:id", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Неверный идентификатор" });
      }
      await storage.deleteCustomer(id);
      res.json({ message: "Покупатель удален" });
    } catch (error) {
      res.status(500).json({ message: "Ошибка удаления покупателя" });
    }
  });

  // ============ WHOLESALE SUPPLIERS ============

  app.get("/api/wholesale/suppliers", requireAuth, async (req, res) => {
    const data = await storage.getAllWholesaleSuppliers();
    res.json(data);
  });

  app.get("/api/wholesale/suppliers/:id", requireAuth, async (req, res) => {
    const id = parseInt(req.params.id);
    const supplier = await storage.getWholesaleSupplier(id);
    if (!supplier) {
      return res.status(404).json({ message: "Поставщик не найден" });
    }
    res.json(supplier);
  });

  app.post("/api/wholesale/suppliers", requireAuth, async (req, res) => {
    try {
      const data = insertWholesaleSupplierSchema.parse(req.body);
      const item = await storage.createWholesaleSupplier(data);
      res.status(201).json(item);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors[0].message });
      }
      res.status(500).json({ message: "Ошибка создания поставщика" });
    }
  });

  app.patch("/api/wholesale/suppliers/:id", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const item = await storage.updateWholesaleSupplier(id, req.body);
      if (!item) {
        return res.status(404).json({ message: "Поставщик не найден" });
      }
      res.json(item);
    } catch (error) {
      res.status(500).json({ message: "Ошибка обновления поставщика" });
    }
  });

  app.delete("/api/wholesale/suppliers/:id", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteWholesaleSupplier(id);
      res.json({ message: "Поставщик удален" });
    } catch (error) {
      res.status(500).json({ message: "Ошибка удаления поставщика" });
    }
  });

  // ============ WHOLESALE BASES ============

  app.get("/api/wholesale/bases", requireAuth, async (req, res) => {
    const supplierId = req.query.supplierId ? parseInt(req.query.supplierId as string) : undefined;
    const data = await storage.getAllWholesaleBases(supplierId);
    res.json(data);
  });

  app.get("/api/wholesale/bases/:id", requireAuth, async (req, res) => {
    const id = parseInt(req.params.id);
    const base = await storage.getWholesaleBase(id);
    if (!base) {
      return res.status(404).json({ message: "Базис не найден" });
    }
    res.json(base);
  });

  app.post("/api/wholesale/bases", requireAuth, async (req, res) => {
    try {
      const data = insertWholesaleBaseSchema.parse(req.body);
      const item = await storage.createWholesaleBase(data);
      res.status(201).json(item);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors[0].message });
      }
      res.status(500).json({ message: "Ошибка создания базиса" });
    }
  });

  app.patch("/api/wholesale/bases/:id", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const item = await storage.updateWholesaleBase(id, req.body);
      if (!item) {
        return res.status(404).json({ message: "Базис не найден" });
      }
      res.json(item);
    } catch (error) {
      res.status(500).json({ message: "Ошибка обновления базиса" });
    }
  });

  app.delete("/api/wholesale/bases/:id", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteWholesaleBase(id);
      res.json({ message: "Базис удален" });
    } catch (error) {
      res.status(500).json({ message: "Ошибка удаления базиса" });
    }
  });

  // ============ REFUELING PROVIDERS ============

  app.get("/api/refueling/providers", requireAuth, async (req, res) => {
    const data = await storage.getAllRefuelingProviders();
    res.json(data);
  });

  app.get("/api/refueling/providers/:id", requireAuth, async (req, res) => {
    const id = parseInt(req.params.id);
    const provider = await storage.getRefuelingProvider(id);
    if (!provider) {
      return res.status(404).json({ message: "Аэропорт/Поставщик не найден" });
    }
    res.json(provider);
  });

  app.post("/api/refueling/providers", requireAuth, async (req, res) => {
    try {
      const data = insertRefuelingProviderSchema.parse(req.body);
      const item = await storage.createRefuelingProvider(data);
      res.status(201).json(item);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors[0].message });
      }
      res.status(500).json({ message: "Ошибка создания аэропорта/поставщика" });
    }
  });

  app.patch("/api/refueling/providers/:id", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const item = await storage.updateRefuelingProvider(id, req.body);
      if (!item) {
        return res.status(404).json({ message: "Аэропорт/Поставщик не найден" });
      }
      res.json(item);
    } catch (error) {
      res.status(500).json({ message: "Ошибка обновления аэропорта/поставщика" });
    }
  });

  app.delete("/api/refueling/providers/:id", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteRefuelingProvider(id);
      res.json({ message: "Аэропорт/Поставщик удален" });
    } catch (error) {
      res.status(500).json({ message: "Ошибка удаления аэропорта/поставщика" });
    }
  });

  // ============ REFUELING BASES ============

  app.get("/api/refueling/bases", requireAuth, async (req, res) => {
    const providerId = req.query.providerId ? parseInt(req.query.providerId as string) : undefined;
    const data = await storage.getAllRefuelingBases(providerId);
    res.json(data);
  });

  app.get("/api/refueling/bases/:id", requireAuth, async (req, res) => {
    const id = parseInt(req.params.id);
    const base = await storage.getRefuelingBase(id);
    if (!base) {
      return res.status(404).json({ message: "Базис заправки не найден" });
    }
    res.json(base);
  });

  app.post("/api/refueling/bases", requireAuth, async (req, res) => {
    try {
      const data = insertRefuelingBaseSchema.parse(req.body);
      const item = await storage.createRefuelingBase(data);
      res.status(201).json(item);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors[0].message });
      }
      res.status(500).json({ message: "Ошибка создания базиса заправки" });
    }
  });

  app.patch("/api/refueling/bases/:id", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const item = await storage.updateRefuelingBase(id, req.body);
      if (!item) {
        return res.status(404).json({ message: "Базис заправки не найден" });
      }
      res.json(item);
    } catch (error) {
      res.status(500).json({ message: "Ошибка обновления базиса заправки" });
    }
  });

  app.delete("/api/refueling/bases/:id", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteRefuelingBase(id);
      res.json({ message: "Базис заправки удален" });
    } catch (error) {
      res.status(500).json({ message: "Ошибка удаления базиса заправки" });
    }
  });

  // ============ LOGISTICS CARRIERS ============

  app.get("/api/logistics/carriers", requireAuth, async (req, res) => {
    const data = await storage.getAllLogisticsCarriers();
    res.json(data);
  });

  app.get("/api/logistics/carriers/:id", requireAuth, async (req, res) => {
    const id = parseInt(req.params.id);
    const carrier = await storage.getLogisticsCarrier(id);
    if (!carrier) {
      return res.status(404).json({ message: "Перевозчик не найден" });
    }
    res.json(carrier);
  });

  app.post("/api/logistics/carriers", requireAuth, async (req, res) => {
    try {
      const data = insertLogisticsCarrierSchema.parse(req.body);
      const item = await storage.createLogisticsCarrier(data);
      res.status(201).json(item);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors[0].message });
      }
      res.status(500).json({ message: "Ошибка создания перевозчика" });
    }
  });

  app.patch("/api/logistics/carriers/:id", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const item = await storage.updateLogisticsCarrier(id, req.body);
      if (!item) {
        return res.status(404).json({ message: "Перевозчик не найден" });
      }
      res.json(item);
    } catch (error) {
      res.status(500).json({ message: "Ошибка обновления перевозчика" });
    }
  });

  app.delete("/api/logistics/carriers/:id", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteLogisticsCarrier(id);
      res.json({ message: "Перевозчик удален" });
    } catch (error) {
      res.status(500).json({ message: "Ошибка удаления перевозчика" });
    }
  });

  // ============ LOGISTICS DELIVERY LOCATIONS ============

  app.get("/api/logistics/delivery-locations", requireAuth, async (req, res) => {
    const data = await storage.getAllLogisticsDeliveryLocations();
    res.json(data);
  });

  app.get("/api/logistics/delivery-locations/:id", requireAuth, async (req, res) => {
    const id = parseInt(req.params.id);
    const location = await storage.getLogisticsDeliveryLocation(id);
    if (!location) {
      return res.status(404).json({ message: "Место доставки не найдено" });
    }
    res.json(location);
  });

  app.post("/api/logistics/delivery-locations", requireAuth, async (req, res) => {
    try {
      const data = insertLogisticsDeliveryLocationSchema.parse(req.body);
      const item = await storage.createLogisticsDeliveryLocation(data);
      res.status(201).json(item);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors[0].message });
      }
      res.status(500).json({ message: "Ошибка создания места доставки" });
    }
  });

  app.patch("/api/logistics/delivery-locations/:id", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const item = await storage.updateLogisticsDeliveryLocation(id, req.body);
      if (!item) {
        return res.status(404).json({ message: "Место доставки не найдено" });
      }
      res.json(item);
    } catch (error) {
      res.status(500).json({ message: "Ошибка обновления места доставки" });
    }
  });

  app.delete("/api/logistics/delivery-locations/:id", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteLogisticsDeliveryLocation(id);
      res.json({ message: "Место доставки удалено" });
    } catch (error) {
      res.status(500).json({ message: "Ошибка удаления места доставки" });
    }
  });

  // ============ LOGISTICS VEHICLES ============

  app.get("/api/logistics/vehicles", requireAuth, async (req, res) => {
    const carrierId = req.query.carrierId ? parseInt(req.query.carrierId as string) : undefined;
    const data = await storage.getAllLogisticsVehicles(carrierId);
    res.json(data);
  });

  app.get("/api/logistics/vehicles/:id", requireAuth, async (req, res) => {
    const id = parseInt(req.params.id);
    const vehicle = await storage.getLogisticsVehicle(id);
    if (!vehicle) {
      return res.status(404).json({ message: "Транспорт не найден" });
    }
    res.json(vehicle);
  });

  app.post("/api/logistics/vehicles", requireAuth, async (req, res) => {
    try {
      const data = insertLogisticsVehicleSchema.parse(req.body);
      const item = await storage.createLogisticsVehicle(data);
      res.status(201).json(item);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors[0].message });
      }
      res.status(500).json({ message: "Ошибка создания транспорта" });
    }
  });

  app.patch("/api/logistics/vehicles/:id", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const item = await storage.updateLogisticsVehicle(id, req.body);
      if (!item) {
        return res.status(404).json({ message: "Транспорт не найден" });
      }
      res.json(item);
    } catch (error) {
      res.status(500).json({ message: "Ошибка обновления транспорта" });
    }
  });

  app.delete("/api/logistics/vehicles/:id", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteLogisticsVehicle(id);
      res.json({ message: "Транспорт удален" });
    } catch (error) {
      res.status(500).json({ message: "Ошибка удаления транспорта" });
    }
  });

  // ============ LOGISTICS TRAILERS ============

  app.get("/api/logistics/trailers", requireAuth, async (req, res) => {
    const carrierId = req.query.carrierId ? parseInt(req.query.carrierId as string) : undefined;
    const data = await storage.getAllLogisticsTrailers(carrierId);
    res.json(data);
  });

  app.get("/api/logistics/trailers/:id", requireAuth, async (req, res) => {
    const id = parseInt(req.params.id);
    const trailer = await storage.getLogisticsTrailer(id);
    if (!trailer) {
      return res.status(404).json({ message: "Прицеп не найден" });
    }
    res.json(trailer);
  });

  app.post("/api/logistics/trailers", requireAuth, async (req, res) => {
    try {
      const data = insertLogisticsTrailerSchema.parse(req.body);
      const item = await storage.createLogisticsTrailer(data);
      res.status(201).json(item);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors[0].message });
      }
      res.status(500).json({ message: "Ошибка создания прицепа" });
    }
  });

  app.patch("/api/logistics/trailers/:id", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const item = await storage.updateLogisticsTrailer(id, req.body);
      if (!item) {
        return res.status(404).json({ message: "Прицеп не найден" });
      }
      res.json(item);
    } catch (error) {
      res.status(500).json({ message: "Ошибка обновления прицепа" });
    }
  });

  app.delete("/api/logistics/trailers/:id", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteLogisticsTrailer(id);
      res.json({ message: "Прицеп удален" });
    } catch (error) {
      res.status(500).json({ message: "Ошибка удаления прицепа" });
    }
  });

  // ============ LOGISTICS DRIVERS ============

  app.get("/api/logistics/drivers", requireAuth, async (req, res) => {
    const carrierId = req.query.carrierId ? parseInt(req.query.carrierId as string) : undefined;
    const data = await storage.getAllLogisticsDrivers(carrierId);
    res.json(data);
  });

  app.get("/api/logistics/drivers/:id", requireAuth, async (req, res) => {
    const id = parseInt(req.params.id);
    const driver = await storage.getLogisticsDriver(id);
    if (!driver) {
      return res.status(404).json({ message: "Водитель не найден" });
    }
    res.json(driver);
  });

  app.post("/api/logistics/drivers", requireAuth, async (req, res) => {
    try {
      const data = insertLogisticsDriverSchema.parse(req.body);
      const item = await storage.createLogisticsDriver(data);
      res.status(201).json(item);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors[0].message });
      }
      res.status(500).json({ message: "Ошибка создания водителя" });
    }
  });

  app.patch("/api/logistics/drivers/:id", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const item = await storage.updateLogisticsDriver(id, req.body);
      if (!item) {
        return res.status(404).json({ message: "Водитель не найден" });
      }
      res.json(item);
    } catch (error) {
      res.status(500).json({ message: "Ошибка обновления водителя" });
    }
  });

  app.delete("/api/logistics/drivers/:id", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteLogisticsDriver(id);
      res.json({ message: "Водитель удален" });
    } catch (error) {
      res.status(500).json({ message: "Ошибка удаления водителя" });
    }
  });

  // ============ LOGISTICS WAREHOUSES/BASES ============

  app.get("/api/logistics/warehouses", requireAuth, async (req, res) => {
    const data = await storage.getAllLogisticsWarehouses();
    res.json(data);
  });

  app.get("/api/logistics/warehouses/:id", requireAuth, async (req, res) => {
    const id = parseInt(req.params.id);
    const warehouse = await storage.getLogisticsWarehouse(id);
    if (!warehouse) {
      return res.status(404).json({ message: "Склад/Базис не найден" });
    }
    res.json(warehouse);
  });

  app.post("/api/logistics/warehouses", requireAuth, async (req, res) => {
    try {
      const data = insertLogisticsWarehouseSchema.parse(req.body);
      const item = await storage.createLogisticsWarehouse(data);
      res.status(201).json(item);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors[0].message });
      }
      res.status(500).json({ message: "Ошибка создания склада/базиса" });
    }
  });

  app.patch("/api/logistics/warehouses/:id", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const item = await storage.updateLogisticsWarehouse(id, req.body);
      if (!item) {
        return res.status(404).json({ message: "Склад/Базис не найден" });
      }
      res.json(item);
    } catch (error) {
      res.status(500).json({ message: "Ошибка обновления склада/базиса" });
    }
  });

  app.delete("/api/logistics/warehouses/:id", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteLogisticsWarehouse(id);
      res.json({ message: "Склад/Базис удален" });
    } catch (error) {
      res.status(500).json({ message: "Ошибка удаления склада/базиса" });
    }
  });

  // ============ PRICES ROUTES ============

  app.get("/api/prices", requireAuth, async (req, res) => {
    const { counterpartyRole, counterpartyType } = req.query;
    if (counterpartyRole && counterpartyType) {
      const data = await storage.getPricesByRole(counterpartyRole as string, counterpartyType as string);
      return res.json(data);
    }
    const data = await storage.getAllPrices();
    res.json(data);
  });

  app.post("/api/prices", requireAuth, async (req, res) => {
    try {
      const body = req.body;
      const processedData = {
        ...body,
        priceValues: body.priceValues?.map((pv: { price: string }) => JSON.stringify({ price: parseFloat(pv.price) })),
        volume: body.volume ? String(body.volume) : null,
        counterpartyId: typeof body.counterpartyId === 'string' ? parseInt(body.counterpartyId) : body.counterpartyId,
      };
      
      const data = insertPriceSchema.parse(processedData);
      const item = await storage.createPrice(data);
      res.status(201).json(item);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors[0].message });
      }
      console.error("Price creation error:", error);
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

  app.get("/api/prices/calculate-selection", requireAuth, async (req, res) => {
    try {
      const { counterpartyId, counterpartyType, basis, dateFrom, dateTo } = req.query;
      
      if (!counterpartyId || !counterpartyType || !basis || !dateFrom || !dateTo) {
        return res.status(400).json({ message: "Не указаны обязательные параметры" });
      }

      const totalVolume = await storage.calculatePriceSelection(
        parseInt(counterpartyId as string),
        counterpartyType as string,
        basis as string,
        dateFrom as string,
        dateTo as string
      );

      res.json({ totalVolume: totalVolume.toFixed(2) });
    } catch (error) {
      console.error("Selection calculation error:", error);
      res.status(500).json({ message: "Ошибка расчета выборки" });
    }
  });

  app.get("/api/prices/check-date-overlaps", requireAuth, async (req, res) => {
    try {
      const { counterpartyId, counterpartyType, counterpartyRole, basis, dateFrom, dateTo, excludeId } = req.query;
      
      if (!counterpartyId || !counterpartyType || !counterpartyRole || !basis || !dateFrom || !dateTo) {
        return res.status(400).json({ message: "Не указаны обязательные параметры" });
      }

      const result = await storage.checkPriceDateOverlaps(
        parseInt(counterpartyId as string),
        counterpartyType as string,
        counterpartyRole as string,
        basis as string,
        dateFrom as string,
        dateTo as string,
        excludeId ? parseInt(excludeId as string) : undefined
      );

      res.json(result);
    } catch (error) {
      console.error("Date overlap check error:", error);
      res.status(500).json({ message: "Ошибка проверки дат" });
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
