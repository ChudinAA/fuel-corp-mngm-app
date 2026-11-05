import { and, eq, isNull, sql } from "drizzle-orm";
import { db } from "../../db";
import {
  counterpartyContracts,
  customers,
  integrationChangeLogs,
  logisticsCarriers,
  nomenclature,
  nomenclatureTypes,
  suppliers,
  unitsOfMeasure,
} from "@shared/schema";
import { getCatalogStatusKind } from "./catalog-sync-contract";

type CatalogType = "counterparty_contracts" | "nomenclature" | "nomenclature_types" | "units_of_measure";
type SyncInput = Record<string, any> & { id_1c: string; status?: string | null };
type SyncResult = { id_1c: string; type: CatalogType; outcome: string; code?: string; entity_id?: string | null };
type BuiltFields = { fields: Record<string, unknown> } | { error: string; message: string };

const tableByCounterpartyType = {
  supplier: suppliers,
  customer: customers,
  carrier: logisticsCarriers,
} as const;

async function recordChange(tx: any, data: {
  requestId: string;
  type: CatalogType;
  entityId?: string | null;
  externalId: string;
  operation: string;
  outcome: string;
  incoming: SyncInput;
  oldData?: unknown;
  newData?: unknown;
  code?: string;
  message?: string;
}) {
  await tx.insert(integrationChangeLogs).values({
    requestId: data.requestId,
    entityType: data.type,
    entityId: data.entityId ?? null,
    external1cId: data.externalId,
    operation: data.operation,
    outcome: data.outcome,
    incomingData: data.incoming,
    oldData: data.oldData ?? null,
    newData: data.newData ?? null,
    errorCode: data.code ?? null,
    errorMessage: data.message ?? null,
  });
}

async function syncRecord(options: {
  requestId: string;
  type: CatalogType;
  table: any;
  item: SyncInput;
  buildFields: (tx: any, item: SyncInput, current: any) => Promise<BuiltFields>;
  beforeDelete?: (tx: any, current: any) => Promise<string | null>;
  onDeleted?: (tx: any, current: any) => Promise<void>;
}): Promise<SyncResult> {
  const { requestId, type, table, item } = options;
  const statusKind = getCatalogStatusKind(item.status);
  try {
    const result = await db.transaction(async (tx) => {
      const [current] = await tx.select().from(table).where(eq(table.id1c, item.id_1c)).limit(1);
      if (statusKind === "unknown") {
        await recordChange(tx, {
          requestId, type, entityId: current?.id, externalId: item.id_1c, operation: "sync",
          outcome: "error", incoming: item, code: "unsupported_status", message: "Неподдерживаемое значение status",
        });
        return { outcome: "error", code: "unsupported_status", entityId: current?.id ?? null };
      }
      if (!current && statusKind === "deleted") {
        await recordChange(tx, {
          requestId, type, externalId: item.id_1c, operation: "delete",
          outcome: "skipped", incoming: item, code: "delete_for_unknown_entity",
          message: "Удаление неизвестной записи пропущено",
        });
        return { outcome: "skipped", code: "delete_for_unknown_entity", entityId: null };
      }

      const oldData = current ? { ...current } : null;
      if (current && statusKind === "deleted") {
        const deleteError = await options.beforeDelete?.(tx, current);
        if (deleteError) {
          await recordChange(tx, {
            requestId, type, entityId: current.id, externalId: item.id_1c, operation: "delete",
            outcome: "error", incoming: item, oldData, code: deleteError,
            message: deleteError === "catalog_record_in_use"
              ? "Запись используется другими справочными или операционными данными"
              : "Запись нельзя удалить из-за связанных данных",
          });
          return { outcome: "error", code: deleteError, entityId: current.id };
        }
      }

      let fields: Record<string, unknown> = {};
      if (statusKind !== "deleted") {
        const built = await options.buildFields(tx, item, current);
        if ("error" in built) {
          await recordChange(tx, {
            requestId, type, entityId: current?.id, externalId: item.id_1c, operation: current ? "update" : "create",
            outcome: "error", incoming: item, oldData, code: built.error, message: built.message,
          });
          return { outcome: "error", code: built.error, entityId: current?.id ?? null };
        }
        fields = built.fields;
      }

      const values = {
        ...fields,
        integrationStatus: item.status || current?.integrationStatus || null,
        deletedAt: statusKind === "deleted" ? current?.deletedAt ?? sql`NOW()` : statusKind === "active" ? null : current?.deletedAt ?? null,
        deletedById: statusKind === "active" ? null : current?.deletedById ?? null,
        updatedAt: sql`NOW()`,
      };
      let entity: any;
      if (current) {
        [entity] = await tx.update(table).set(values).where(eq(table.id, current.id)).returning();
      } else {
        const inserted: any = await tx.insert(table).values({ ...values, id1c: item.id_1c, deletedAt: null, deletedById: null }).returning();
        entity = inserted[0] ?? inserted.rows?.[0];
      }

      if (statusKind === "deleted") await options.onDeleted?.(tx, current);
      const outcome = !current ? "created" : statusKind === "deleted" ? "deleted" : "updated";
      await recordChange(tx, {
        requestId, type, entityId: entity.id, externalId: item.id_1c,
        operation: !current ? "create" : statusKind === "deleted" ? "delete" : "update",
        outcome, incoming: item, oldData, newData: entity,
      });
      return { outcome, entityId: entity.id };
    });
    return { id_1c: item.id_1c, type, outcome: result.outcome, code: result.code, entity_id: result.entityId };
  } catch (error: any) {
    const duplicate = error?.code === "23505";
    const code = duplicate ? "duplicate_id_1c_or_unique_field" : "database_error";
    await db.insert(integrationChangeLogs).values({
      requestId,
      entityType: type,
      external1cId: item.id_1c,
      operation: "sync",
      outcome: "error",
      incomingData: item,
      errorCode: code,
      errorMessage: duplicate ? "Id_1c или уникальное поле уже используется" : "Не удалось сохранить изменение",
    }).catch((logError) => console.error("[1C integration] Failed to write catalog change log:", logError?.message));
    return { id_1c: item.id_1c, type, outcome: "error", code };
  }
}

async function resolveCounterparty(
  tx: any,
  item: SyncInput,
): Promise<{ error: string; message: string } | { partyFields: Record<string, unknown>; party: any }> {
  const table = tableByCounterpartyType[item.counterparty_type as keyof typeof tableByCounterpartyType];
  if (!table) return { error: "unsupported_counterparty_type", message: "Неизвестный тип контрагента" };
  const [party] = await tx.select().from(table)
    .where(and(eq(table.external1cId, item.counterparty_id_1c), isNull(table.deletedAt))).limit(1);
  if (!party) return { error: "counterparty_not_linked", message: "Контрагент из Id_1c не найден или удалён; сначала синхронизируйте контрагентов" };
  return {
    partyFields: item.counterparty_type === "supplier"
      ? { supplierId: party.id, buyerId: null, carrierId: null }
      : item.counterparty_type === "customer"
        ? { supplierId: null, buyerId: party.id, carrierId: null }
        : { supplierId: null, buyerId: null, carrierId: party.id },
    party,
  };
}

export async function syncContract(item: SyncInput, requestId: string): Promise<SyncResult> {
  return syncRecord({
    requestId, type: "counterparty_contracts", table: counterpartyContracts, item,
    buildFields: async (tx, incoming, current) => {
      const resolved = await resolveCounterparty(tx, incoming);
      if ("error" in resolved) return resolved;
      let parentContractId = current?.parentContractId ?? null;
      if (incoming.parent_contract_id_1c !== undefined) {
        parentContractId = null;
        if (incoming.parent_contract_id_1c) {
          const [parent] = await tx.select().from(counterpartyContracts)
            .where(and(eq(counterpartyContracts.id1c, incoming.parent_contract_id_1c), isNull(counterpartyContracts.deletedAt)))
            .limit(1);
          if (!parent) return { error: "parent_contract_not_found", message: "Основной договор не найден; синхронизируйте его перед приложением" };
          const partyFields = resolved.partyFields;
          if (parent.parentContractId || parent.supplierId !== partyFields.supplierId ||
              parent.buyerId !== partyFields.buyerId || parent.carrierId !== partyFields.carrierId) {
            return { error: "invalid_parent_contract", message: "Приложение должно быть связано с основным договором того же контрагента" };
          }
          parentContractId = parent.id;
        }
      }
      return { fields: {
        contractName: incoming.contract_name,
        contractNumber: incoming.contract_number,
        contractDate: incoming.contract_date,
        ...resolved.partyFields,
        counterparty1cId: incoming.counterparty_id_1c,
        counterpartyType: incoming.counterparty_type,
        parent1cId: incoming.parent_contract_id_1c !== undefined
          ? incoming.parent_contract_id_1c
          : current?.parent1cId ?? null,
        parentContractId,
      } };
    },
  });
}

export async function syncNomenclatureType(item: SyncInput, requestId: string): Promise<SyncResult> {
  return syncRecord({
    requestId, type: "nomenclature_types", table: nomenclatureTypes, item,
    buildFields: async (_tx, incoming) => ({ fields: { code: incoming.code, name: incoming.name } }),
    beforeDelete: async (tx, current) => {
      const [usage] = await tx.select({ id: nomenclature.id }).from(nomenclature)
        .where(and(eq(nomenclature.nomenclatureTypeId, current.id), isNull(nomenclature.deletedAt))).limit(1);
      return usage ? "catalog_record_in_use" : null;
    },
  });
}

export async function syncUnit(item: SyncInput, requestId: string): Promise<SyncResult> {
  return syncRecord({
    requestId, type: "units_of_measure", table: unitsOfMeasure, item,
    buildFields: async (tx, incoming, current) => {
      let referenceUnitId = current?.referenceUnitId ?? null;
      if (incoming.reference_unit_id_1c !== undefined) {
        referenceUnitId = null;
        if (incoming.reference_unit_id_1c) {
          if (incoming.reference_unit_id_1c === incoming.id_1c) {
            return { error: "unit_reference_cycle", message: "Единица измерения не может ссылаться сама на себя" };
          }
          const [reference] = await tx.select().from(unitsOfMeasure)
            .where(and(eq(unitsOfMeasure.id1c, incoming.reference_unit_id_1c), isNull(unitsOfMeasure.deletedAt))).limit(1);
          if (!reference) return { error: "reference_unit_not_found", message: "Единица пересчёта не найдена; синхронизируйте её первой" };
          referenceUnitId = reference.id;
        }
      }
      return { fields: {
        shortName: incoming.short_name,
        fullName: incoming.full_name,
        conversionFactor: incoming.conversion_factor === undefined ? current?.conversionFactor ?? null : incoming.conversion_factor,
        referenceUnitId,
      } };
    },
    beforeDelete: async (tx, current) => {
      const [itemUsage] = await tx.select({ id: nomenclature.id }).from(nomenclature)
        .where(and(eq(nomenclature.unitId, current.id), isNull(nomenclature.deletedAt))).limit(1);
      const [unitUsage] = await tx.select({ id: unitsOfMeasure.id }).from(unitsOfMeasure)
        .where(and(eq(unitsOfMeasure.referenceUnitId, current.id), isNull(unitsOfMeasure.deletedAt))).limit(1);
      return itemUsage || unitUsage ? "catalog_record_in_use" : null;
    },
  });
}

export async function syncNomenclatureItem(item: SyncInput, requestId: string): Promise<SyncResult> {
  return syncRecord({
    requestId, type: "nomenclature", table: nomenclature, item,
    buildFields: async (tx, incoming, current) => {
      const [unit] = await tx.select().from(unitsOfMeasure)
        .where(and(eq(unitsOfMeasure.id1c, incoming.unit_id_1c), isNull(unitsOfMeasure.deletedAt))).limit(1);
      if (!unit) return { error: "unit_not_found", message: "Единица измерения не найдена; синхронизируйте её первой" };
      let nomenclatureTypeId = current?.nomenclatureTypeId ?? null;
      if (incoming.nomenclature_type_id_1c !== undefined) {
        nomenclatureTypeId = null;
        if (incoming.nomenclature_type_id_1c) {
          const [type] = await tx.select().from(nomenclatureTypes)
            .where(and(eq(nomenclatureTypes.id1c, incoming.nomenclature_type_id_1c), isNull(nomenclatureTypes.deletedAt))).limit(1);
          if (!type) return { error: "nomenclature_type_not_found", message: "Вид номенклатуры не найден; синхронизируйте его первым" };
          nomenclatureTypeId = type.id;
        }
      }
      const isDefault = incoming.is_default ?? current?.isDefault ?? false;
      if (isDefault) {
        await tx.update(nomenclature).set({ isDefault: false })
          .where(and(eq(nomenclature.productType, incoming.product_type), isNull(nomenclature.deletedAt)));
      }
      return { fields: {
        productType: incoming.product_type,
        nomenclatureTypeId,
        name: incoming.name,
        unitId: unit.id,
        isDefault,
      } };
    },
    onDeleted: async (tx, current) => {
      if (!current.isDefault) return;
      const [next] = await tx.select().from(nomenclature)
        .where(and(eq(nomenclature.productType, current.productType), isNull(nomenclature.deletedAt)))
        .limit(1);
      if (next) await tx.update(nomenclature).set({ isDefault: true }).where(eq(nomenclature.id, next.id));
    },
  });
}

export async function syncCatalogBatch(type: CatalogType, items: SyncInput[], requestId: string) {
  const sync = type === "counterparty_contracts" ? syncContract
    : type === "nomenclature" ? syncNomenclatureItem
      : type === "nomenclature_types" ? syncNomenclatureType : syncUnit;
  const seen = new Set<string>();
  const results: SyncResult[] = [];
  for (const item of items) {
    if (seen.has(item.id_1c)) {
      await db.insert(integrationChangeLogs).values({
        requestId, entityType: type, external1cId: item.id_1c, operation: "sync", outcome: "error",
        incomingData: item, errorCode: "duplicate_item_in_batch", errorMessage: "Id_1c повторяется в одном пакете",
      });
      results.push({ id_1c: item.id_1c, type, outcome: "error", code: "duplicate_item_in_batch" });
      continue;
    }
    seen.add(item.id_1c);
    results.push(await sync(item, requestId));
  }
  const counts = results.reduce<Record<string, number>>((acc, result) => {
    acc[result.outcome] = (acc[result.outcome] ?? 0) + 1;
    return acc;
  }, {});
  return { request_id: requestId, count: results.length, counts, results };
}
