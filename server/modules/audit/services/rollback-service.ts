
import { db } from "../../../db";
import { auditLog, AUDIT_OPERATIONS, EntityType } from "../entities/audit";
import { eq, and, desc, sql } from "drizzle-orm";
import { AuditService, AuditContext } from "./audit-service";
import { storage } from "../../../storage/index";
import { warehouseTransactions, warehouses } from "@shared/schema";
import { PRODUCT_TYPE, SOURCE_TYPE, TRANSACTION_TYPE } from "@shared/constants";

export interface RollbackOptions {
  auditLogId: string;
  context: AuditContext;
}

export interface RollbackResult {
  success: boolean;
  message: string;
  restoredData?: any;
}

export class RollbackService {
  /**
   * Rollback a specific audit entry
   */
  static async rollback(options: RollbackOptions): Promise<RollbackResult> {
    const { auditLogId, context } = options;

    try {
      // Get the audit entry
      const auditEntry = await db.query.auditLog.findFirst({
        where: eq(auditLog.id, auditLogId),
      });

      if (!auditEntry) {
        return {
          success: false,
          message: "Запись аудита не найдена",
        };
      }

      // Check if already rolled back
      if (auditEntry.rolledBackAt) {
        return {
          success: false,
          message: "Эта запись уже была откачена",
        };
      }

      // Check if rollback is possible
      if (!this.canRollback(auditEntry.operation as any)) {
        return {
          success: false,
          message: `Невозможно откатить операцию ${auditEntry.operation}`,
        };
      }

      // Perform rollback based on operation type
      const result = await this.performRollback(auditEntry, context);

      // If rollback was successful, mark the audit entry as rolled back
      if (result.success) {
        await db.update(auditLog)
          .set({
            rolledBackAt: new Date().toISOString(),
            rolledBackById: context.userId,
          })
          .where(eq(auditLog.id, auditLogId));
      }

      return result;
    } catch (error: any) {
      console.error("Rollback error:", error);
      return {
        success: false,
        message: `Ошибка при откате: ${error.message}`,
      };
    }
  }

  /**
   * Check if an operation can be rolled back
   */
  private static canRollback(operation: string): boolean {
    // Can rollback CREATE (delete), UPDATE (restore old data), DELETE (restore)
    return [
      AUDIT_OPERATIONS.CREATE,
      AUDIT_OPERATIONS.UPDATE,
      AUDIT_OPERATIONS.DELETE,
    ].includes(operation as any);
  }

  /**
   * Perform the actual rollback operation
   */
  private static async performRollback(
    auditEntry: any,
    context: AuditContext
  ): Promise<RollbackResult> {
    const { entityType, entityId, operation, oldData, newData } = auditEntry;

    switch (operation) {
      case AUDIT_OPERATIONS.CREATE:
        // Rollback CREATE: soft delete the created entity
        return this.rollbackCreate(entityType, entityId, newData, context);

      case AUDIT_OPERATIONS.UPDATE:
        // Rollback UPDATE: restore old data
        return this.rollbackUpdate(entityType, entityId, oldData, context);

      case AUDIT_OPERATIONS.DELETE:
        // Rollback DELETE: restore the deleted entity
        return this.rollbackDelete(entityType, entityId, oldData, context);

      default:
        return {
          success: false,
          message: `Неподдерживаемая операция: ${operation}`,
        };
    }
  }

  /**
   * Rollback a CREATE operation (soft delete)
   */
  private static async rollbackCreate(
    entityType: EntityType,
    entityId: string,
    createdData: any,
    context: AuditContext
  ): Promise<RollbackResult> {
    try {
      // Get the current entity to store before deletion
      const currentEntity = await this.getEntity(entityType, entityId);
      
      if (!currentEntity) {
        return {
          success: false,
          message: "Сущность не найдена",
        };
      }

      // Soft delete using storage methods (with related entities cleanup)
      await this.deleteEntity(entityType, entityId, context.userId);

      // Log the rollback as a DELETE operation
      await AuditService.log({
        entityType,
        entityId,
        operation: AUDIT_OPERATIONS.DELETE,
        oldData: currentEntity,
        newData: null,
        context: {
          ...context,
          userName: `${context.userName} (откат создания)`,
        },
      });

      return {
        success: true,
        message: "Создание отменено (запись удалена)",
      };
    } catch (error: any) {
      return {
        success: false,
        message: `Ошибка при откате создания: ${error.message}`,
      };
    }
  }

  /**
   * Rollback an UPDATE operation (restore old data)
   */
  private static async rollbackUpdate(
    entityType: EntityType,
    entityId: string,
    oldData: any,
    context: AuditContext
  ): Promise<RollbackResult> {
    try {
      if (!oldData) {
        return {
          success: false,
          message: "Нет данных для восстановления",
        };
      }

      // Get current data before rollback
      const currentData = await this.getEntity(entityType, entityId);

      // Normalize oldData: convert empty strings to null for UUID fields
      const normalizedOldData = this.normalizeData(oldData);

      // Update entity with old data
      await this.updateEntity(entityType, entityId, normalizedOldData, context.userId);

      // Log the rollback as an UPDATE operation
      await AuditService.log({
        entityType,
        entityId,
        operation: AUDIT_OPERATIONS.UPDATE,
        oldData: currentData,
        newData: normalizedOldData,
        context: {
          ...context,
          userName: `${context.userName} (откат изменения)`,
        },
      });

      return {
        success: true,
        message: "Изменения отменены (данные восстановлены)",
        restoredData: normalizedOldData,
      };
    } catch (error: any) {
      return {
        success: false,
        message: `Ошибка при откате изменения: ${error.message}`,
      };
    }
  }

  /**
   * Rollback a DELETE operation (restore entity)
   */
  private static async rollbackDelete(
    entityType: EntityType,
    entityId: string,
    oldData: any,
    context: AuditContext
  ): Promise<RollbackResult> {
    try {
      if (!oldData) {
        return {
          success: false,
          message: "Нет данных для восстановления",
        };
      }

      // Restore entity using storage methods (set deletedAt = NULL)
      await this.restoreEntity(entityType, entityId, oldData, context.userId);

      // Log the rollback as a RESTORE operation
      await AuditService.log({
        entityType,
        entityId,
        operation: AUDIT_OPERATIONS.RESTORE,
        oldData: null,
        newData: oldData,
        context: {
          ...context,
          userName: `${context.userName} (откат удаления)`,
        },
      });

      return {
        success: true,
        message: "Удаление отменено (запись восстановлена)",
        restoredData: oldData,
      };
    } catch (error: any) {
      return {
        success: false,
        message: `Ошибка при откате удаления: ${error.message}`,
      };
    }
  }

  /**
   * Normalize data: convert empty strings to null and handle special fields
   */
  private static normalizeData(data: any): any {
    if (!data || typeof data !== 'object') {
      return data;
    }

    const normalized: any = {};
    for (const [key, value] of Object.entries(data)) {
      // Convert empty strings to null
      if (value === '') {
        normalized[key] = null;
        continue;
      }

      // Handle baseIds - convert string to array
      if (key === 'baseIds') {
        if (typeof value === 'string') {
          // Single baseId as string
          normalized[key] = [value];
        } else if (Array.isArray(value)) {
          normalized[key] = value;
        } else {
          normalized[key] = [];
        }
        continue;
      }

      // Handle priceValues - PostgreSQL text[] array
      // When read from DB, it's already a JavaScript array of JSON strings like ["{\"price\":73}"]
      // We need to keep it as an array, NOT stringify the whole array
      if (key === 'priceValues') {
        // If it's null/undefined, set to null (will be handled by Drizzle)
        if (value === null || value === undefined) {
          normalized[key] = null;
          continue;
        }

        // If it's already an array (most common case from DB)
        if (Array.isArray(value)) {
          // Each item should be a JSON string like "{\"price\":73}"
          // Just pass the array as-is, no additional JSON.stringify needed
          normalized[key] = value;
          continue;
        }

        // If it's a string, try to parse it as JSON
        if (typeof value === 'string') {
          try {
            const parsed = JSON.parse(value);
            
            // If parsed result is an array, use it
            if (Array.isArray(parsed)) {
              // Ensure each item is a JSON string
              normalized[key] = parsed.map(item => 
                typeof item === 'string' ? item : JSON.stringify(item)
              );
            } 
            // If it's an object like {price: 73}, wrap it
            else if (parsed && typeof parsed === 'object') {
              normalized[key] = [JSON.stringify(parsed)];
            }
            // Otherwise treat original string as single item
            else {
              normalized[key] = [value];
            }
          } catch {
            // Not valid JSON, treat as single item
            normalized[key] = [value];
          }
          continue;
        }

        // If it's an object, wrap it in array
        if (typeof value === 'object') {
          normalized[key] = [JSON.stringify(value)];
          continue;
        }

        // For any other type, convert to string and wrap in array
        normalized[key] = [String(value)];
        continue;
      }

      normalized[key] = value;
    }
    return normalized;
  }

  /**
   * Get entity by type and ID
   */
  private static async getEntity(entityType: EntityType, entityId: string): Promise<any> {
    const storageMap: Record<string, () => Promise<any>> = {
      opt: () => storage.opt.getOpt(entityId),
      aircraft_refueling: () => storage.aircraftRefueling.getRefueling(entityId),
      movement: () => storage.movement.getMovement(entityId),
      exchange: () => storage.exchange.getExchange(entityId),
      warehouses: () => storage.warehouses.getWarehouse(entityId),
      prices: () => storage.prices.getPrice(entityId),
      suppliers: () => storage.suppliers.getSupplier(entityId),
      customers: () => storage.customers.getCustomer(entityId),
      bases: () => storage.bases.getBase(entityId),
      logistics_carriers: () => storage.logistics.getLogisticsCarrier(entityId),
      logistics_delivery_locations: () => storage.logistics.getLogisticsDeliveryLocation(entityId),
      logistics_vehicles: () => storage.logistics.getLogisticsVehicle(entityId),
      logistics_trailers: () => storage.logistics.getLogisticsTrailer(entityId),
      logistics_drivers: () => storage.logistics.getLogisticsDriver(entityId),
      delivery_cost: () => storage.delivery.getDeliveryCost(entityId),
      cashflow_transactions: () => storage.cashflow.getCashflowTransaction(entityId),
      payment_calendar: () => storage.payments.getPaymentCalendarItem(entityId),
      price_calculations: () => storage.priceCalculations.getPriceCalculation(entityId),
      users: () => storage.users.getUser(entityId),
      roles: () => storage.roles.getRole(entityId),
    };

    const getter = storageMap[entityType];
    if (!getter) {
      throw new Error(`Unknown entity type: ${entityType}`);
    }

    return getter();
  }

  /**
   * Update entity by type and ID
   */
  private static async updateEntity(
    entityType: EntityType,
    entityId: string,
    data: any,
    userId?: string
  ): Promise<void> {
    const storageMap: Record<string, (id: string, data: any, userId?: string) => Promise<any>> = {
      opt: (id, data, userId) => storage.opt.updateOpt(id, { ...data, updatedById: userId }),
      aircraft_refueling: (id, data, userId) => storage.aircraftRefueling.updateRefueling(id, { ...data, updatedById: userId }),
      movement: (id, data, userId) => storage.movement.updateMovement(id, { ...data, updatedById: userId }),
      exchange: (id, data, userId) => storage.exchange.updateExchange(id, { ...data, updatedById: userId }),
      warehouses: (id, data, userId) => storage.warehouses.updateWarehouse(id, { ...data, updatedById: userId }),
      prices: (id, data, userId) => storage.prices.updatePrice(id, { ...data, updatedById: userId }),
      suppliers: (id, data, userId) => storage.suppliers.updateSupplier(id, { ...data, updatedById: userId }),
      customers: (id, data, userId) => storage.customers.updateCustomer(id, { ...data, updatedById: userId }),
      bases: (id, data, userId) => storage.bases.updateBase(id, { ...data, updatedById: userId }),
      logistics_carriers: (id, data, userId) => storage.logistics.updateLogisticsCarrier(id, { ...data, updatedById: userId }),
      logistics_delivery_locations: (id, data, userId) => storage.logistics.updateLogisticsDeliveryLocation(id, { ...data, updatedById: userId }),
      logistics_vehicles: (id, data, userId) => storage.logistics.updateLogisticsVehicle(id, { ...data, updatedById: userId }),
      logistics_trailers: (id, data, userId) => storage.logistics.updateLogisticsTrailer(id, { ...data, updatedById: userId }),
      logistics_drivers: (id, data, userId) => storage.logistics.updateLogisticsDriver(id, { ...data, updatedById: userId }),
      delivery_cost: (id, data, userId) => storage.delivery.updateDeliveryCost(id, { ...data }, userId),
      cashflow_transactions: (id, data, userId) => storage.cashflow.updateCashflowTransaction(id, { ...data, updatedById: userId }),
      payment_calendar: (id, data, userId) => storage.payments.updatePaymentCalendarItem(id, { ...data, updatedById: userId }),
      price_calculations: (id, data, userId) => storage.priceCalculations.updatePriceCalculation(id, { ...data, updatedById: userId }),
      users: (id, data, userId) => storage.users.updateUser(id, data, userId),
      roles: (id, data, userId) => storage.roles.updateRole(id, data),
    };

    const updater = storageMap[entityType];
    if (!updater) {
      throw new Error(`Unknown entity type: ${entityType}`);
    }

    await updater(entityId, data, userId);
  }

  /**
   * Delete entity by type and ID (soft delete)
   * This also handles related entities cleanup
   */
  private static async deleteEntity(
    entityType: EntityType,
    entityId: string,
    userId?: string
  ): Promise<void> {
    const storageMap: Record<string, (id: string, userId?: string) => Promise<any>> = {
      opt: (id, userId) => storage.opt.deleteOpt(id, userId),
      aircraft_refueling: (id, userId) => storage.aircraftRefueling.deleteRefueling(id, userId),
      movement: (id, userId) => storage.movement.deleteMovement(id, userId),
      exchange: (id, userId) => storage.exchange.deleteExchange(id, userId),
      warehouses: (id, userId) => storage.warehouses.deleteWarehouse(id, userId),
      prices: (id, userId) => storage.prices.deletePrice(id, userId),
      suppliers: (id, userId) => storage.suppliers.deleteSupplier(id, userId),
      customers: (id, userId) => storage.customers.deleteCustomer(id, userId),
      bases: (id, userId) => storage.bases.deleteBase(id, userId),
      logistics_carriers: (id, userId) => storage.logistics.deleteLogisticsCarrier(id, userId),
      logistics_delivery_locations: (id, userId) => storage.logistics.deleteLogisticsDeliveryLocation(id, userId),
      logistics_vehicles: (id, userId) => storage.logistics.deleteLogisticsVehicle(id, userId),
      logistics_trailers: (id, userId) => storage.logistics.deleteLogisticsTrailer(id, userId),
      logistics_drivers: (id, userId) => storage.logistics.deleteLogisticsDriver(id, userId),
      delivery_cost: (id, userId) => storage.delivery.deleteDeliveryCost(id, userId),
      cashflow_transactions: (id, userId) => storage.cashflow.deleteCashflowTransaction(id, userId),
      payment_calendar: (id, userId) => storage.payments.deletePaymentCalendarItem(id, userId),
      price_calculations: (id, userId) => storage.priceCalculations.deletePriceCalculation(id, userId),
      users: (id, userId) => storage.users.deleteUser(id, userId),
      roles: (id, userId) => storage.roles.deleteRole(id, userId),
    };

    const deleter = storageMap[entityType];
    if (!deleter) {
      throw new Error(`Unknown entity type: ${entityType}`);
    }

    // Storage methods already handle related entities (transactions, etc.)
    await deleter(entityId, userId);
  }

  /**
   * Restore entity by type and ID (set deletedAt = NULL)
   * This also handles related entities restoration
   */
  private static async restoreEntity(
    entityType: EntityType,
    entityId: string,
    oldData: any,
    userId?: string
  ): Promise<void> {
    const storageMap: Record<string, (id: string, oldData: any, userId?: string) => Promise<any>> = {
      opt: (id, oldData, userId) => storage.opt.restoreOpt(id, oldData, userId),
      aircraft_refueling: (id, oldData, userId) => storage.aircraftRefueling.restoreRefueling(id, oldData, userId),
      movement: (id, oldData, userId) => storage.movement.restoreMovement(id, oldData, userId),
      exchange: (id, oldData, userId) => storage.exchange.restoreExchange(id, userId),
      warehouses: (id, oldData, userId) => storage.warehouses.restoreWarehouse(id, userId),
      prices: (id, oldData, userId) => storage.prices.restorePrice(id, userId),
      suppliers: (id, oldData, userId) => storage.suppliers.restoreSupplier(id, userId),
      customers: (id, oldData, userId) => storage.customers.restoreCustomer(id, userId),
      bases: (id, oldData, userId) => storage.bases.restoreBase(id, userId),
      logistics_carriers: (id, oldData, userId) => storage.logistics.restoreLogisticsCarrier(id, userId),
      logistics_delivery_locations: (id, oldData, userId) => storage.logistics.restoreLogisticsDeliveryLocation(id, userId),
      logistics_vehicles: (id, oldData, userId) => storage.logistics.restoreLogisticsVehicle(id, userId),
      logistics_trailers: (id, oldData, userId) => storage.logistics.restoreLogisticsTrailer(id, userId),
      logistics_drivers: (id, oldData, userId) => storage.logistics.restoreLogisticsDriver(id, userId),
      delivery_cost: (id, oldData, userId) => storage.delivery.restoreDeliveryCost(id, userId),
      cashflow_transactions: (id, oldData, userId) => storage.cashflow.restoreCashflowTransaction(id, userId),
      payment_calendar: (id, oldData, userId) => storage.payments.restorePaymentCalendarItem(id, userId),
      price_calculations: (id, oldData, userId) => storage.priceCalculations.restorePriceCalculation(id, userId),
      users: (id, oldData, userId) => storage.users.restoreUser(id, userId),
      roles: (id, oldData, userId) => storage.roles.restoreRole(id, userId),
    };

    const restorer = storageMap[entityType];
    if (!restorer) {
      throw new Error(`Unknown entity type: ${entityType}`);
    }

    await restorer(entityId, oldData, userId);
  }
}
