
import { db } from "../../../db";
import { auditLog, AUDIT_OPERATIONS, EntityType } from "../entities/audit";
import { eq, and, desc } from "drizzle-orm";
import { AuditService, AuditContext } from "./audit-service";
import { storage } from "../../../storage/index";

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

      // Check if rollback is possible
      if (!this.canRollback(auditEntry.operation as any)) {
        return {
          success: false,
          message: `Невозможно откатить операцию ${auditEntry.operation}`,
        };
      }

      // Perform rollback based on operation type
      const result = await this.performRollback(auditEntry, context);

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
        return this.rollbackCreate(entityType, entityId, context);

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

      // Soft delete using storage methods
      await this.deleteEntity(entityType, entityId);

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

      // Update entity with old data
      await this.updateEntity(entityType, entityId, oldData);

      // Log the rollback as an UPDATE operation
      await AuditService.log({
        entityType,
        entityId,
        operation: AUDIT_OPERATIONS.UPDATE,
        oldData: currentData,
        newData: oldData,
        context: {
          ...context,
          userName: `${context.userName} (откат изменения)`,
        },
      });

      return {
        success: true,
        message: "Изменения отменены (данные восстановлены)",
        restoredData: oldData,
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

      // Restore entity using storage methods
      await this.restoreEntity(entityType, entityId);

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
   * Get entity by type and ID
   */
  private static async getEntity(entityType: EntityType, entityId: string): Promise<any> {
    const storageMap: Record<string, any> = {
      opt: storage.opt,
      aircraft_refueling: storage.aircraftRefueling,
      movement: storage.movement,
      exchange: storage.exchange,
      warehouses: storage.warehouses,
      prices: storage.prices,
      suppliers: storage.suppliers,
      customers: storage.customers,
      bases: storage.bases,
      logistics_carriers: storage.logistics,
      logistics_delivery_locations: storage.logistics,
      logistics_vehicles: storage.logistics,
      logistics_trailers: storage.logistics,
      logistics_drivers: storage.logistics,
      delivery_cost: storage.delivery,
      users: storage.users,
      roles: storage.roles,
    };

    const storageService = storageMap[entityType];
    if (!storageService) {
      throw new Error(`Unknown entity type: ${entityType}`);
    }

    // Use appropriate getter method
    if (entityType === 'logistics_carriers') {
      return storageService.getCarrier(entityId);
    } else if (entityType === 'logistics_delivery_locations') {
      return storageService.getDeliveryLocation(entityId);
    } else if (entityType === 'logistics_vehicles') {
      return storageService.getVehicle(entityId);
    } else if (entityType === 'logistics_trailers') {
      return storageService.getTrailer(entityId);
    } else if (entityType === 'logistics_drivers') {
      return storageService.getDriver(entityId);
    } else if (entityType === 'users') {
      return storageService.getUser(entityId);
    } else if (entityType === 'roles') {
      return storageService.getRole(entityId);
    }

    // For other entities, try common getter patterns
    const methods = ['get', 'getById', 'findById'];
    for (const method of methods) {
      if (typeof storageService[method] === 'function') {
        return storageService[method](entityId);
      }
    }

    throw new Error(`No getter method found for entity type: ${entityType}`);
  }

  /**
   * Update entity by type and ID
   */
  private static async updateEntity(entityType: EntityType, entityId: string, data: any): Promise<void> {
    const storageMap: Record<string, any> = {
      opt: storage.opt,
      aircraft_refueling: storage.aircraftRefueling,
      movement: storage.movement,
      exchange: storage.exchange,
      warehouses: storage.warehouses,
      prices: storage.prices,
      suppliers: storage.suppliers,
      customers: storage.customers,
      bases: storage.bases,
      logistics_carriers: storage.logistics,
      logistics_delivery_locations: storage.logistics,
      logistics_vehicles: storage.logistics,
      logistics_trailers: storage.logistics,
      logistics_drivers: storage.logistics,
      delivery_cost: storage.delivery,
      users: storage.users,
      roles: storage.roles,
    };

    const storageService = storageMap[entityType];
    if (!storageService) {
      throw new Error(`Unknown entity type: ${entityType}`);
    }

    // Use appropriate update method
    if (entityType === 'logistics_carriers') {
      await storageService.updateCarrier(entityId, data);
    } else if (entityType === 'logistics_delivery_locations') {
      await storageService.updateDeliveryLocation(entityId, data);
    } else if (entityType === 'logistics_vehicles') {
      await storageService.updateVehicle(entityId, data);
    } else if (entityType === 'logistics_trailers') {
      await storageService.updateTrailer(entityId, data);
    } else if (entityType === 'logistics_drivers') {
      await storageService.updateDriver(entityId, data);
    } else if (entityType === 'users') {
      await storageService.updateUser(entityId, data);
    } else if (entityType === 'roles') {
      await storageService.updateRole(entityId, data);
    } else if (typeof storageService.update === 'function') {
      await storageService.update(entityId, data);
    } else {
      throw new Error(`No update method found for entity type: ${entityType}`);
    }
  }

  /**
   * Delete entity by type and ID
   */
  private static async deleteEntity(entityType: EntityType, entityId: string): Promise<void> {
    const storageMap: Record<string, any> = {
      opt: storage.opt,
      aircraft_refueling: storage.aircraftRefueling,
      movement: storage.movement,
      exchange: storage.exchange,
      warehouses: storage.warehouses,
      prices: storage.prices,
      suppliers: storage.suppliers,
      customers: storage.customers,
      bases: storage.bases,
      logistics_carriers: storage.logistics,
      logistics_delivery_locations: storage.logistics,
      logistics_vehicles: storage.logistics,
      logistics_trailers: storage.logistics,
      logistics_drivers: storage.logistics,
      delivery_cost: storage.delivery,
      users: storage.users,
      roles: storage.roles,
    };

    const storageService = storageMap[entityType];
    if (!storageService) {
      throw new Error(`Unknown entity type: ${entityType}`);
    }

    // Use appropriate delete method
    if (entityType === 'logistics_carriers') {
      await storageService.deleteCarrier(entityId);
    } else if (entityType === 'logistics_delivery_locations') {
      await storageService.deleteDeliveryLocation(entityId);
    } else if (entityType === 'logistics_vehicles') {
      await storageService.deleteVehicle(entityId);
    } else if (entityType === 'logistics_trailers') {
      await storageService.deleteTrailer(entityId);
    } else if (entityType === 'logistics_drivers') {
      await storageService.deleteDriver(entityId);
    } else if (entityType === 'users') {
      await storageService.deleteUser(entityId);
    } else if (entityType === 'roles') {
      await storageService.deleteRole(entityId);
    } else if (typeof storageService.delete === 'function') {
      await storageService.delete(entityId);
    } else {
      throw new Error(`No delete method found for entity type: ${entityType}`);
    }
  }

  /**
   * Restore entity by type and ID
   */
  private static async restoreEntity(entityType: EntityType, entityId: string): Promise<void> {
    const storageMap: Record<string, any> = {
      opt: storage.opt,
      aircraft_refueling: storage.aircraftRefueling,
      movement: storage.movement,
      exchange: storage.exchange,
      warehouses: storage.warehouses,
      prices: storage.prices,
      suppliers: storage.suppliers,
      customers: storage.customers,
      bases: storage.bases,
      logistics_carriers: storage.logistics,
      logistics_delivery_locations: storage.logistics,
      logistics_vehicles: storage.logistics,
      logistics_trailers: storage.logistics,
      logistics_drivers: storage.logistics,
      delivery_cost: storage.delivery,
      users: storage.users,
      roles: storage.roles,
    };

    const storageService = storageMap[entityType];
    if (!storageService) {
      throw new Error(`Unknown entity type: ${entityType}`);
    }

    // Use appropriate restore method
    if (entityType === 'logistics_carriers') {
      await storageService.restoreCarrier(entityId);
    } else if (entityType === 'logistics_delivery_locations') {
      await storageService.restoreDeliveryLocation(entityId);
    } else if (entityType === 'logistics_vehicles') {
      await storageService.restoreVehicle(entityId);
    } else if (entityType === 'logistics_trailers') {
      await storageService.restoreTrailer(entityId);
    } else if (entityType === 'logistics_drivers') {
      await storageService.restoreDriver(entityId);
    } else if (entityType === 'users') {
      await storageService.restoreUser(entityId);
    } else if (entityType === 'roles') {
      await storageService.restoreRole(entityId);
    } else if (typeof storageService.restore === 'function') {
      await storageService.restore(entityId);
    } else {
      throw new Error(`No restore method found for entity type: ${entityType}`);
    }
  }
}
