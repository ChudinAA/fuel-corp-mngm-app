import { and, asc, eq, isNull, inArray, sql } from "drizzle-orm";
import { db } from "server/db";
import {
  counterpartyContracts,
  nomenclature,
  nomenclatureTypes,
  unitsOfMeasure,
  suppliers,
  customers,
  logisticsCarriers,
} from "@shared/schema";

export class CatalogStorage {
  async getContracts(filters: {
    supplierId?: string;
    buyerId?: string;
    carrierId?: string;
  } = {}) {
    const conditions: any[] = [isNull(counterpartyContracts.deletedAt)];
    if (filters.supplierId) conditions.push(eq(counterpartyContracts.supplierId, filters.supplierId));
    if (filters.buyerId) conditions.push(eq(counterpartyContracts.buyerId, filters.buyerId));
    if (filters.carrierId) conditions.push(eq(counterpartyContracts.carrierId, filters.carrierId));

    const rows = await db
      .select()
      .from(counterpartyContracts)
      .where(and(...conditions))
      .orderBy(asc(counterpartyContracts.contractDate), asc(counterpartyContracts.contractNumber));

    const supplierIds = rows.flatMap((row) => row.supplierId ? [row.supplierId] : []);
    const buyerIds = rows.flatMap((row) => row.buyerId ? [row.buyerId] : []);
    const carrierIds = rows.flatMap((row) => row.carrierId ? [row.carrierId] : []);
    const [supplierRows, buyerRows, carrierRows] = await Promise.all([
      supplierIds.length ? db.select({ id: suppliers.id, name: suppliers.name }).from(suppliers).where(inArray(suppliers.id, supplierIds)) : [],
      buyerIds.length ? db.select({ id: customers.id, name: customers.name }).from(customers).where(inArray(customers.id, buyerIds)) : [],
      carrierIds.length ? db.select({ id: logisticsCarriers.id, name: logisticsCarriers.name }).from(logisticsCarriers).where(inArray(logisticsCarriers.id, carrierIds)) : [],
    ]);
    const names = new Map([...supplierRows, ...buyerRows, ...carrierRows].map((row) => [row.id, row.name]));
    return rows.map((contract) => ({
      ...contract,
      counterpartyName: names.get(contract.supplierId || contract.buyerId || contract.carrierId || "") || "",
      counterpartyType: contract.supplierId ? "supplier" : contract.buyerId ? "buyer" : "carrier",
    }));
  }

  async getContract(id: string) {
    const [row] = await db
      .select()
      .from(counterpartyContracts)
      .where(and(eq(counterpartyContracts.id, id), isNull(counterpartyContracts.deletedAt)))
      .limit(1);
    return row;
  }

  async createContract(data: any) {
    const [row] = await db.insert(counterpartyContracts).values(data).returning();
    return row;
  }

  async updateContract(id: string, data: any) {
    const [row] = await db
      .update(counterpartyContracts)
      .set({ ...data, updatedAt: new Date().toISOString() })
      .where(and(eq(counterpartyContracts.id, id), isNull(counterpartyContracts.deletedAt)))
      .returning();
    return row;
  }

  async deleteContract(id: string, userId: string) {
    const [row] = await db
      .update(counterpartyContracts)
      .set({ deletedAt: new Date().toISOString(), deletedById: userId })
      .where(and(eq(counterpartyContracts.id, id), isNull(counterpartyContracts.deletedAt)))
      .returning();
    return row;
  }

  async restoreContract(id: string, _oldData?: any, userId?: string) {
    const [row] = await db
      .update(counterpartyContracts)
      .set({ deletedAt: null, deletedById: null, updatedAt: new Date().toISOString(), updatedById: userId })
      .where(eq(counterpartyContracts.id, id))
      .returning();
    return row;
  }

  async getNomenclatureTypes() {
    return db.select().from(nomenclatureTypes)
      .where(isNull(nomenclatureTypes.deletedAt))
      .orderBy(asc(nomenclatureTypes.name));
  }

  async getNomenclatureType(id: string) {
    const [row] = await db.select().from(nomenclatureTypes)
      .where(and(eq(nomenclatureTypes.id, id), isNull(nomenclatureTypes.deletedAt))).limit(1);
    return row;
  }

  async getUnits() {
    return db.select().from(unitsOfMeasure)
      .where(isNull(unitsOfMeasure.deletedAt))
      .orderBy(asc(unitsOfMeasure.shortName));
  }

  async getUnit(id: string) {
    const [row] = await db.select().from(unitsOfMeasure)
      .where(and(eq(unitsOfMeasure.id, id), isNull(unitsOfMeasure.deletedAt))).limit(1);
    return row;
  }

  async getNomenclature(typeCode?: string) {
    const conditions: any[] = [isNull(nomenclature.deletedAt), isNull(unitsOfMeasure.deletedAt)];
    if (typeCode) conditions.push(eq(nomenclature.productType, typeCode));
    const rows = await db
      .select({ item: nomenclature, typeCode: nomenclature.productType, typeName: nomenclatureTypes.name, unitShortName: unitsOfMeasure.shortName, unitFullName: unitsOfMeasure.fullName })
      .from(nomenclature)
      .leftJoin(nomenclatureTypes, eq(nomenclature.nomenclatureTypeId, nomenclatureTypes.id))
      .innerJoin(unitsOfMeasure, eq(nomenclature.unitId, unitsOfMeasure.id))
      .where(and(...conditions))
      .orderBy(asc(nomenclature.productType), asc(nomenclature.name));
    return rows.map(({ item, ...details }) => ({ ...item, ...details }));
  }

  async getNomenclatureItem(id: string) {
    const [row] = await db.select().from(nomenclature)
      .where(and(eq(nomenclature.id, id), isNull(nomenclature.deletedAt))).limit(1);
    return row;
  }

  async createNomenclature(data: any) {
    return db.transaction(async (tx) => {
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext('catalog-nomenclature-defaults'))`);
      if (data.isDefault) {
        await tx.update(nomenclature).set({ isDefault: false })
          .where(and(eq(nomenclature.productType, data.productType), isNull(nomenclature.deletedAt)));
      }
      const [row] = await tx.insert(nomenclature).values(data).returning();
      return row;
    });
  }

  async updateNomenclature(id: string, data: any) {
    return db.transaction(async (tx) => {
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext('catalog-nomenclature-defaults'))`);
      const [current] = await tx.select().from(nomenclature)
        .where(and(eq(nomenclature.id, id), isNull(nomenclature.deletedAt))).limit(1);
      if (!current) return undefined;
      const productType = data.productType ?? current.productType;
      if (!["kerosene", "pvkj", "service"].includes(productType || "")) throw new Error("Выберите тип продукта");
      if (data.isDefault ?? current.isDefault) {
        await tx.update(nomenclature).set({ isDefault: false })
          .where(and(eq(nomenclature.productType, productType!), isNull(nomenclature.deletedAt)));
      }
      const [row] = await tx.update(nomenclature)
        .set({ ...data, isDefault: data.isDefault ?? current.isDefault, updatedAt: new Date().toISOString() })
        .where(eq(nomenclature.id, id)).returning();
      return row;
    });
  }

  async deleteNomenclature(id: string, userId: string) {
    const old = await this.getNomenclatureItem(id);
    if (!old) return undefined;
    const [row] = await db.update(nomenclature)
      .set({ deletedAt: new Date().toISOString(), deletedById: userId, isDefault: false })
      .where(eq(nomenclature.id, id)).returning();
    if (old.isDefault) {
      const [next] = await db.select().from(nomenclature)
        .where(and(eq(nomenclature.productType, old.productType!), isNull(nomenclature.deletedAt)))
        .orderBy(asc(nomenclature.createdAt)).limit(1);
      if (next) await db.update(nomenclature).set({ isDefault: true }).where(eq(nomenclature.id, next.id));
    }
    return row;
  }

  async restoreNomenclature(id: string, oldData?: any, userId?: string) {
    const current = await this.getNomenclatureItemEvenDeleted(id);
    if (!current) return undefined;
    if (oldData?.isDefault) {
      await db.update(nomenclature).set({ isDefault: false })
        .where(and(eq(nomenclature.productType, current.productType!), isNull(nomenclature.deletedAt)));
    }
    const [row] = await db.update(nomenclature)
      .set({ deletedAt: null, deletedById: null, updatedAt: new Date().toISOString(), updatedById: userId, isDefault: !!oldData?.isDefault })
      .where(eq(nomenclature.id, id)).returning();
    return row;
  }

  private async getNomenclatureItemEvenDeleted(id: string) {
    const [row] = await db.select().from(nomenclature).where(eq(nomenclature.id, id)).limit(1);
    return row;
  }

  async createType(data: any) {
    const [row] = await db.insert(nomenclatureTypes).values(data).returning();
    return row;
  }
  async updateType(id: string, data: any) {
    const [row] = await db.update(nomenclatureTypes).set({ ...data, updatedAt: new Date().toISOString() })
      .where(and(eq(nomenclatureTypes.id, id), isNull(nomenclatureTypes.deletedAt))).returning();
    return row;
  }
  async deleteType(id: string, userId: string) {
    const [used] = await db.select({ id: nomenclature.id }).from(nomenclature)
      .where(and(eq(nomenclature.nomenclatureTypeId, id), isNull(nomenclature.deletedAt))).limit(1);
    if (used) throw new Error("Сначала удалите или перенесите номенклатуру этого вида");
    const [row] = await db.update(nomenclatureTypes).set({ deletedAt: new Date().toISOString(), deletedById: userId })
      .where(and(eq(nomenclatureTypes.id, id), isNull(nomenclatureTypes.deletedAt))).returning();
    return row;
  }
  async restoreType(id: string, _oldData?: any, userId?: string) {
    const [row] = await db.update(nomenclatureTypes).set({ deletedAt: null, deletedById: null, updatedAt: new Date().toISOString(), updatedById: userId })
      .where(eq(nomenclatureTypes.id, id)).returning();
    return row;
  }

  async createUnit(data: any) {
    await this.validateUnitConversion(data);
    const [row] = await db.insert(unitsOfMeasure).values(data).returning();
    return row;
  }
  async updateUnit(id: string, data: any) {
    const current = await this.getUnit(id);
    if (!current) return undefined;
    await this.validateUnitConversion({ ...current, ...data }, id);
    const [row] = await db.update(unitsOfMeasure).set({ ...data, updatedAt: new Date().toISOString() })
      .where(and(eq(unitsOfMeasure.id, id), isNull(unitsOfMeasure.deletedAt))).returning();
    return row;
  }
  async deleteUnit(id: string, userId: string) {
    const [reference] = await db.select({ id: unitsOfMeasure.id }).from(unitsOfMeasure)
      .where(and(eq(unitsOfMeasure.referenceUnitId, id), isNull(unitsOfMeasure.deletedAt))).limit(1);
    if (reference) throw new Error("Единица используется для пересчёта других единиц измерения");
    const [used] = await db.select({ id: nomenclature.id }).from(nomenclature)
      .where(and(eq(nomenclature.unitId, id), isNull(nomenclature.deletedAt))).limit(1);
    if (used) throw new Error("Единица измерения используется в номенклатуре");
    const [row] = await db.update(unitsOfMeasure).set({ deletedAt: new Date().toISOString(), deletedById: userId })
      .where(and(eq(unitsOfMeasure.id, id), isNull(unitsOfMeasure.deletedAt))).returning();
    return row;
  }
  async restoreUnit(id: string, _oldData?: any, userId?: string) {
    const [row] = await db.update(unitsOfMeasure).set({ deletedAt: null, deletedById: null, updatedAt: new Date().toISOString(), updatedById: userId })
      .where(eq(unitsOfMeasure.id, id)).returning();
    return row;
  }

  private async validateUnitConversion(data: any, id?: string) {
    if (!!data.referenceUnitId !== !!data.conversionFactor) {
      throw new Error("Для пересчёта укажите единицу измерения и положительную кратность либо очистите оба поля");
    }
    const visited = new Set<string>(id ? [id] : []);
    let referenceId = data.referenceUnitId;
    while (referenceId) {
      if (visited.has(referenceId)) throw new Error("Единица не может ссылаться на себя или образовывать цикл пересчёта");
      visited.add(referenceId);
      const unit = await this.getUnit(referenceId);
      if (!unit) throw new Error("Единица для пересчёта не найдена");
      referenceId = unit.referenceUnitId;
    }
  }
}
