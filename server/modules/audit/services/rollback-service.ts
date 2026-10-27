
import { db } from "../../../db";
import { auditLog, AUDIT_OPERATIONS, EntityType } from "../entities/audit";
import { eq, and, desc, sql, inArray, isNull } from "drizzle-orm";
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
      if (result.success && auditEntry.operation !== AUDIT_OPERATIONS.DELETE) {
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
        return this.rollbackDelete(auditEntry.id, entityType, entityId, oldData, context);

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

      // Write the rollback history first. If this fails, leave the entity and
      // original audit entry untouched rather than reporting a partial rollback.
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
      }, db, true);

      // Soft delete using storage methods (with related entities cleanup)
      await this.deleteEntity(entityType, entityId, context.userId);

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

      // Write the rollback history first. If this fails, leave the entity and
      // original audit entry untouched rather than reporting a partial rollback.
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
      }, db, true);

      // Update entity with old data
      await this.updateEntity(entityType, entityId, normalizedOldData, context.userId);

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
    auditLogId: string,
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

      if (entityType === "aircraft_refueling") {
        const { restoredDeals, productSummary } = await db.transaction(async (tx) => {
          const restoredDeals =
            await storage.aircraftRefueling.restoreRefuelingOrder(
              entityId,
              context.userId,
              tx,
            );
          const restoredDealIds = restoredDeals.map((deal) => deal.id);
          const productSummary = restoredDeals
            .map((deal) => {
              const product =
                deal.productType === "kerosene"
                  ? "Керосин"
                  : deal.productType === "pvkj"
                    ? "ПВКЖ"
                    : deal.productType === "service"
                      ? "Услуга"
                      : deal.productType;
              const quantity = Number(deal.quantityKg || 0);
              return `${product}${quantity ? ` — ${quantity} кг` : ""}`;
            })
            .join(", ");
          const restoredAt = new Date().toISOString();

          // The order's rows, rollback markers, and restore entry must commit
          // together. Any failed audit write aborts the stock restoration too.
          await tx
            .update(auditLog)
            .set({
              rolledBackAt: restoredAt,
              rolledBackById: context.userId,
            })
            .where(
              and(
                eq(auditLog.entityType, entityType),
                eq(auditLog.operation, AUDIT_OPERATIONS.DELETE),
                isNull(auditLog.rolledBackAt),
                inArray(auditLog.entityId, restoredDealIds),
              ),
            );

          await AuditService.log(
            {
              entityType,
              entityId,
              operation: AUDIT_OPERATIONS.RESTORE,
              oldData: null,
              newData: restoredDeals[0],
              context: {
                ...context,
                userName: `${context.userName} (откат удаления заказа)`,
              },
              extraMeta: { orderProducts: productSummary },
            },
            tx,
            true,
          );

          return { restoredDeals, productSummary };
        });

        return {
          success: true,
          message: `Восстановлен весь заказ заправки: ${restoredDeals.length} позиций (${productSummary}).`,
          restoredData: {
            ...restoredDeals[0],
            restoredOrderDeals: restoredDeals,
          },
        };
      }

      await db.transaction(async (tx) => {
        // Restore the entity, its related records, and both audit changes as one unit.
        await this.restoreEntity(entityType, entityId, oldData, context.userId, tx);

        const restoredAt = new Date().toISOString();
        await tx
          .update(auditLog)
          .set({
            rolledBackAt: restoredAt,
            rolledBackById: context.userId,
          })
          .where(eq(auditLog.id, auditLogId));

        await AuditService.log(
          {
            entityType,
            entityId,
            operation: AUDIT_OPERATIONS.RESTORE,
            oldData: null,
            newData: oldData,
            context: {
              ...context,
              userName: `${context.userName} (откат удаления)`,
            },
          },
          tx,
          true,
        );
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
      counterparty_contracts: () => storage.catalogs.getContract(entityId),
      nomenclature: () => storage.catalogs.getNomenclatureItem(entityId),
      nomenclature_types: () => storage.catalogs.getNomenclatureType(entityId),
      units_of_measure: () => storage.catalogs.getUnit(entityId),
      opt: () => storage.opt.getOpt(entityId),
      aircraft_refueling: () => storage.aircraftRefueling.getRefueling(entityId),
      aircraft_refueling_abroad: () => storage.aircraftRefueling.getRefueling(entityId),
      movement: () => storage.movement.getMovement(entityId),
      exchange: () => storage.exchangeDeals.getDeal(entityId),
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
      equipment: () => storage.equipment.getEquipment(entityId),
      equipment_movement: () => (storage as any).equipmentMovement.getMovement(entityId),
      transportation: () => (storage as any).transportation.getTransportation(entityId),
      railway_stations: () => (storage as any).railway.getStation(entityId),
      railway_tariffs: () => (storage as any).railway.getTariff(entityId),
      exchange_deals: () => (storage as any).exchangeDeals.getDeal(entityId),
      exchange_advance_cards: () => (storage as any).exchangeAdvances.getCard(entityId),
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
      counterparty_contracts: (id, data, userId) => storage.catalogs.updateContract(id, { ...data, updatedById: userId }),
      nomenclature: (id, data, userId) => storage.catalogs.updateNomenclature(id, { ...data, updatedById: userId }),
      nomenclature_types: (id, data, userId) => storage.catalogs.updateType(id, { ...data, updatedById: userId }),
      units_of_measure: (id, data, userId) => storage.catalogs.updateUnit(id, { ...data, updatedById: userId }),
      opt: (id, data, userId) => storage.opt.updateOpt(id, { ...data, updatedById: userId }),
      aircraft_refueling: (id, data, userId) => storage.aircraftRefueling.updateRefueling(id, { ...data, updatedById: userId }),
      aircraft_refueling_abroad: (id, data, userId) => storage.aircraftRefueling.updateRefueling(id, { ...data, updatedById: userId }),
      movement: (id, data, userId) => storage.movement.updateMovement(id, { ...data, updatedById: userId }),
      exchange: (id, data, userId) => storage.exchangeDeals.updateDeal(id, { ...data, updatedById: userId }, userId),
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
      equipment: (id, data, userId) => storage.equipment.updateEquipment(id, { ...data, updatedById: userId }),
      equipment_movement: (id, data, userId) => (storage as any).equipmentMovement.updateMovement(id, { ...data, updatedById: userId }),
      transportation: (id, data, userId) => (storage as any).transportation.updateTransportation(id, { ...data, updatedById: userId }),
      railway_stations: (id, data, userId) => (storage as any).railway.updateStation(id, data, userId),
      railway_tariffs: (id, data, userId) => (storage as any).railway.updateTariff(id, data, userId),
      exchange_deals: (id, data, userId) => (storage as any).exchangeDeals.updateDeal(id, data, userId),
      exchange_advance_cards: (id, data, userId) => (storage as any).exchangeAdvances.updateCard(id, data, userId),
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
      counterparty_contracts: (id, userId) => storage.catalogs.deleteContract(id, userId!),
      nomenclature: (id, userId) => storage.catalogs.deleteNomenclature(id, userId!),
      nomenclature_types: (id, userId) => storage.catalogs.deleteType(id, userId!),
      units_of_measure: (id, userId) => storage.catalogs.deleteUnit(id, userId!),
      opt: (id, userId) => storage.opt.deleteOpt(id, userId),
      aircraft_refueling: (id, userId) => storage.aircraftRefueling.deleteRefueling(id, userId),
      aircraft_refueling_abroad: (id, userId) => storage.aircraftRefueling.deleteRefueling(id, userId),
      movement: (id, userId) => storage.movement.deleteMovement(id, userId),
      exchange: (id, userId) => storage.exchangeDeals.deleteDeal(id, userId),
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
      equipment: (id, userId) => storage.equipment.deleteEquipment(id, userId!),
      equipment_movement: (id, userId) => (storage as any).equipmentMovement.deleteMovement(id, userId),
      transportation: (id, userId) => (storage as any).transportation.deleteTransportation(id, userId),
      railway_stations: (id, userId) => (storage as any).railway.deleteStation(id, userId),
      railway_tariffs: (id, userId) => (storage as any).railway.deleteTariff(id, userId),
      exchange_deals: (id, userId) => (storage as any).exchangeDeals.deleteDeal(id, userId),
      exchange_advance_cards: (id, userId) => (storage as any).exchangeAdvances.deleteCard(id, userId),
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
    userId?: string,
    transaction?: any,
  ): Promise<void> {
    const storageMap: Record<string, (id: string, oldData: any, userId?: string, transaction?: any) => Promise<any>> = {
      opt: (id, oldData, userId, tx) => storage.opt.restoreOpt(id, oldData, userId, tx),
      aircraft_refueling: (id, oldData, userId, tx) => storage.aircraftRefueling.restoreRefueling(id, oldData, userId, tx),
      aircraft_refueling_abroad: (id, oldData, userId, tx) => storage.aircraftRefueling.restoreRefueling(id, oldData, userId, tx),
      movement: (id, oldData, userId, tx) => storage.movement.restoreMovement(id, oldData, userId, tx),
      exchange: (id, oldData, userId, tx) => storage.exchangeDeals.restoreDeal(id, oldData, userId, tx),
      warehouses: (id, oldData, userId, tx) => storage.warehouses.restoreWarehouse(id, userId, tx),
      prices: (id, oldData, userId, tx) => storage.prices.restorePrice(id, userId, tx),
      suppliers: (id, oldData, userId, tx) => storage.suppliers.restoreSupplier(id, userId, tx),
      customers: (id, oldData, userId, tx) => storage.customers.restoreCustomer(id, userId, tx),
      bases: (id, oldData, userId, tx) => storage.bases.restoreBase(id, userId, tx),
      logistics_carriers: (id, oldData, userId, tx) => storage.logistics.restoreLogisticsCarrier(id, userId, tx),
      logistics_delivery_locations: (id, oldData, userId, tx) => storage.logistics.restoreLogisticsDeliveryLocation(id, userId, tx),
      logistics_vehicles: (id, oldData, userId, tx) => storage.logistics.restoreLogisticsVehicle(id, userId, tx),
      logistics_trailers: (id, oldData, userId, tx) => storage.logistics.restoreLogisticsTrailer(id, userId, tx),
      logistics_drivers: (id, oldData, userId, tx) => storage.logistics.restoreLogisticsDriver(id, userId, tx),
      delivery_cost: (id, oldData, userId, tx) => storage.delivery.restoreDeliveryCost(id, userId, tx),
      cashflow_transactions: (id, oldData, userId, tx) => storage.cashflow.restoreCashflowTransaction(id, userId, tx),
      payment_calendar: (id, oldData, userId, tx) => storage.payments.restorePaymentCalendarItem(id, userId, tx),
      price_calculations: (id, oldData, userId, tx) => storage.priceCalculations.restorePriceCalculation(id, userId, tx),
      users: (id, oldData, userId, tx) => storage.users.restoreUser(id, userId, tx),
      roles: (id, oldData, userId, tx) => storage.roles.restoreRole(id, userId, tx),
      equipment: (id, oldData, userId, tx) => storage.equipment.restoreEquipment(id, userId!, tx),
      equipment_movement: (id, oldData, userId, tx) => (storage as any).equipmentMovement.restoreMovement(id, oldData, userId, tx),
      transportation: (id, oldData, userId, tx) => (storage as any).transportation.restoreTransportation(id, oldData, userId, tx),
      railway_stations: (id, oldData, userId, tx) => (storage as any).railway.restoreStation(id, oldData, tx),
      railway_tariffs: (id, oldData, userId, tx) => (storage as any).railway.restoreTariff(id, oldData, tx),
      exchange_deals: (id, oldData, userId, tx) => (storage as any).exchangeDeals.restoreDeal(id, oldData, userId, tx),
      exchange_advance_cards: (id, oldData, userId, tx) => (storage as any).exchangeAdvances.restoreCard(id, oldData, userId, tx),
      counterparty_contracts: (id, oldData, userId, tx) => storage.catalogs.restoreContract(id, oldData, userId, tx),
      nomenclature: (id, oldData, userId, tx) => storage.catalogs.restoreNomenclature(id, oldData, userId, tx),
      nomenclature_types: (id, oldData, userId, tx) => storage.catalogs.restoreType(id, oldData, userId, tx),
      units_of_measure: (id, oldData, userId, tx) => storage.catalogs.restoreUnit(id, oldData, userId, tx),
    };

    const restorer = storageMap[entityType];
    if (!restorer) {
      throw new Error(`Unknown entity type: ${entityType}`);
    }

    await restorer(entityId, oldData, userId, transaction);
  }
}
