/**
 * Вспомогательные функции для панели аудита:
 * - форматирование значений (UUID, enum, числа, даты, булевы)
 * - фильтрация технических полей
 * - сравнение чисел с учётом погрешности float
 * - вычисление видимых изменений
 * - идентификация сущности в строке превью
 */

import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { getFieldLabel, hasFieldLabel, hasZodRegistryLabel, FIELD_LABELS } from "./field-labels";
// Инициализация реестра форм-схем — регистрирует Zod .describe() как метки полей.
// Этот side-effect import достаточно выполнить один раз при загрузке audit-helpers.
import "./form-schema-registry";
import type { AuditEntry } from "@/hooks/use-audit";

// ─── UUID detection ───────────────────────────────────────────────────────────
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUUID = (v: unknown): boolean =>
  typeof v === "string" && UUID_RE.test(v);

// ─── Технические поля — всегда скрываем ──────────────────────────────────────
const ALWAYS_SKIP = new Set([
  // PK и аудит-метаданные
  "id", "createdAt", "updatedAt", "deletedAt",
  "createdById", "updatedById", "deletedById",
  // Внутренние FK (UUID без человеческого названия)
  "transactionId", "sourceTransactionId", "exchangeId",
  "purchasePriceId", "salePriceId", "equipmentId", "equipmentTransactionId",
  "exchangeRateId", "purchaseExchangeRateId", "saleExchangeRateId",
  "currencyId", "localCurrencyId", "cardId", "storageCardId",
  "buyerStorageCardId", "buyerTransactionId", "relatedDealId",
  "sourceId", "basisId", "customerBasisId", "loadingBasisId",
  "counterpartyId", "planningResourceId", "scenarioId",
  "movementId", "deliveryTariffId", "syncId", "planEntryId",
  "deliveryCostId", "fromEntityId", "toEntityId",
  "currentLocationEntityId", "currentLocationEntityType",
  "fromEntityType", "toEntityType",
  "departureStationId", "destinationStationId",
  "buyerSupplierId", "intermediaryId",
  "ipAddress", "userAgent", "rolledBackAt", "rolledBackById", "entityDeleted",
  // Вычисляемые/readonly
  "averageCost", "currentStock",
  "pvkjBalance", "pvkjAverageCost",
  "isRecalculating", "soldVolume", "soldAmount", "dateCheckWarning",
  "weightedAverageRate", "balanceBefore", "balanceAfter",
  "averageCostBefore", "averageCostAfter",
  "weightedAverageRateBefore", "weightedAverageRateAfter",
  // Транзитные поля запроса (склад) — техника для операции, не данные
  "newSupplierData", "supplierLinkMode", "createSupplier", "linkedSupplierId",
  "bases",
  // Технические флаги
  "setSalePriceZero", "purchasePriceModified", "equipmentType",
  // Сложные вложенные объекты (глобально; разрешаем для конкретных сущностей ниже)
  "intermediaries", "priceValues",
  // Прочее внутреннее
  "isPinned", "rtNumber", "currentCurrencyCode", "currentCurrencyId",
  "localCurrencyCode", "localCurrencySymbol", "currencySymbol",
  "version", "deletedBy",
  // Логистика внутреннее
  "isOptimal", "isUnplanned", "unavailabilityReason",
  // Планирование
  "isManualBalance",
]);

// Поля разрешены только для конкретных сущностей (переопределяют ALWAYS_SKIP)
const ENTITY_SPECIFIC_SHOW: Record<string, Set<string>> = {
  exchange_advance_cards: new Set(["currentBalance"]),
  // Склады: базисы и услуги — не технические, должны быть видны
  warehouses: new Set(["baseIds", "services"]),
  // Цены: список цен и контрагент — показываем (сервер форматирует как строку)
  prices: new Set(["priceValues", "counterpartyId"]),
  // Зарубеж: посредники и банки в цепочке — показываем (сервер форматирует как строку)
  aircraft_refueling_abroad: new Set(["intermediaries", "bankCommissions"]),
  // Перевозки: базис погрузки
  transportation: new Set(["basisId"]),
  // Биржа: покупатель-поставщик (buyerSupplierId — FK на поставщика-покупателя)
  exchange_deals: new Set(["buyerSupplierId"]),
  // Перемещения ОП: оборудование (FK из equipment таблицы)
  equipment_movement: new Set(["fromEquipmentId", "toEquipmentId"]),
};

/** Нужно ли показывать поле пользователю */
export function isFieldVisible(entityType: string, fieldName: string): boolean {
  const entityOverride = ENTITY_SPECIFIC_SHOW[entityType];
  if (entityOverride?.has(fieldName)) return true;

  // Если поле явно описано в Zod-схеме формы (.describe()), показываем его
  // даже если оно есть в ALWAYS_SKIP. Это позволяет user-facing FK-полям
  // (напр. counterpartyId в prices, fromEquipmentId в equipment_movement)
  // быть видимыми когда разработчик явно пометил поле как значимое.
  // Технические поля (id, createdAt и т.д.) никогда не получат .describe() в формах.
  if (hasZodRegistryLabel(entityType, fieldName)) return true;

  if (ALWAYS_SKIP.has(fieldName)) return false;

  // Неизвестные *Id без метки в любом реестре → скрываем
  if (fieldName.endsWith("Id") && fieldName !== "inn") {
    if (!hasFieldLabel(entityType, fieldName)) return false;
  }
  return true;
}

// ─── Переводы перечислений ────────────────────────────────────────────────────
const ENUM_MAP: Record<string, Record<string, string>> = {
  productType: {
    kerosene: "Керосин", diesel: "Дизельное топливо", pvkj: "ПВКЖ",
    pvkj_tk: "ПВКЖ ТК", gasoline: "Бензин", jet_fuel: "Авиакеросин",
    mazut: "Мазут", service: "Услуга заправки", agent: "Агентское",
    storage: "Хранение",
  },
  movementType: {
    supply: "Приход", expense: "Расход", transfer: "Перемещение", exchange: "Обмен",
    internal: "Внутреннее",
  },
  inputMode: { kg: "по кг", liters: "по литрам", liter: "по литрам" },
  equipmentType: { common: "ОП", lik: "ЛИК", pvkj: "ПВКЖ" },
  productTypeFull: {
    kerosene: "Керосин", diesel: "Дизельное топливо", pvkj: "ПВКЖ",
    pvkj_tk: "ПВКЖ ТК", gasoline: "Бензин", jet_fuel: "Авиакеросин",
    mazut: "Мазут", service: "Услуга заправки", agent: "Агентское",
    storage: "Хранение",
  },
  otherServiceType: {
    fixed: "Фиксированная", per_kg: "За кг", per_liter: "За литр", per_ton: "За тонну",
  },
  counterpartyType: {
    supplier: "Поставщик", customer: "Покупатель",
    buyer: "Покупатель", seller: "Продавец",
    purchase: "Закупка", sale: "Продажа",
    buy: "Покупка", sell: "Продажа",
  },
  counterpartyRole: {
    supplier: "Поставщик", customer: "Покупатель", carrier: "Перевозчик",
    buyer: "Покупатель", seller: "Продавец",
  },
  currency: {
    RUB: "Рубль (₽)", USD: "Доллар ($)", EUR: "Евро (€)",
    KZT: "Тенге", CNY: "Юань", GBP: "Фунт",
  },
  cardType: { advance: "Аванс", deposit: "Депозит", exchange: "Биржа" },
  transactionType: {
    income: "Приход", expense: "Расход", replenishment: "Пополнение",
    withdrawal: "Списание", transfer: "Перемещение",
  },
  limitType: { volume: "По объёму", amount: "По сумме", none: "Без ограничений" },
  priceUnit: { per_kg: "За кг", per_liter: "За литр", per_ton: "За тонну" },
  baseType: {
    wholesale: "Опт", refueling: "Заправки", abroad: "Зарубеж", lik: "ЛИК",
  },
  schedule: {
    full_week: "Каждый день", weekdays: "Пн–Пт", three_days: "3/3", two_two: "2/2",
  },
  type: {
    // logistics_plan_routes
    route: "Маршрут", return: "Возврат", idle: "Простой",
    // plan_entries
    supply: "Приход", expense: "Расход", balance: "Остаток",
  },
  status: {
    active: "Активен", inactive: "Неактивен", pending: "Ожидает",
    completed: "Завершён", cancelled: "Отменён", draft: "Черновик",
    planned: "Запланирован", in_progress: "В работе",
  },
};

function translateEnum(fieldName: string, value: string): string | null {
  const direct = ENUM_MAP[fieldName];
  if (direct?.[value] !== undefined) return direct[value];
  // Попытка по всем таблицам для распространённых полей
  for (const key of [
    "productType", "movementType", "inputMode", "equipmentType",
    "currency", "cardType", "transactionType", "status",
    "limitType", "priceUnit", "baseType",
  ]) {
    const t = ENUM_MAP[key];
    if (t?.[value] !== undefined) return t[value];
  }
  return null;
}

// ─── Числа с точностью ───────────────────────────────────────────────────────
/** Нормализует число до 5 знаков после запятой */
function normalizeNum(v: unknown): number | null {
  if (typeof v === "number" && isFinite(v))
    return Math.round(v * 1e5) / 1e5;
  if (typeof v === "string") {
    const n = parseFloat(v);
    if (!isNaN(n) && isFinite(n)) return Math.round(n * 1e5) / 1e5;
  }
  return null;
}

/** Числа считаются равными если разница < 0.00001 */
export function areApproxEqual(a: unknown, b: unknown): boolean {
  const na = normalizeNum(a);
  const nb = normalizeNum(b);
  if (na !== null && nb !== null) return na === nb;
  return false;
}

// ─── Форматирование значений ──────────────────────────────────────────────────
/** Форматирует значение поля для отображения пользователю */
export function formatValue(
  value: unknown,
  fieldName?: string,
  entityMeta?: Record<string, string> | null
): string {
  if (value === null || value === undefined || value === "") return "—";

  // UUID → пробуем найти имя в entityMeta (ключ — сам UUID), иначе "задано"
  if (isUUID(value)) {
    if (entityMeta && typeof value === "string" && entityMeta[value]) {
      return entityMeta[value];
    }
    return "задано";
  }

  // Массив
  if (Array.isArray(value)) {
    if (value.length === 0) return "—";
    // UUID-массив → пробуем резолвить через entityMeta (например baseIds)
    if (
      entityMeta &&
      value.every((x) => typeof x === "string" && UUID_RE.test(x))
    ) {
      const resolved = value.map((uuid) => entityMeta[uuid as string] || uuid);
      return resolved.join(", ");
    }
    // Строки/числа (например номера вагонов)
    if (value.every((x) => typeof x === "string" || typeof x === "number")) {
      return value.join(", ");
    }
    return `${value.length} записей`;
  }

  // Объект
  if (typeof value === "object") return "—";

  // Булево
  if (typeof value === "boolean") return value ? "Да" : "Нет";

  // Числа
  if (typeof value === "number") {
    const rounded = Math.round(value * 1e5) / 1e5;
    return rounded.toLocaleString("ru-RU", {
      maximumFractionDigits: 5,
      minimumFractionDigits: 0,
    });
  }

  if (typeof value === "string") {
    // Булевы строки
    if (value === "true") return "Да";
    if (value === "false") return "Нет";

    // Нечитаемые сериализованные объекты (старые записи) — скрываем
    if (value === "[object Object]" || /^\[object Object\]/.test(value)) return "—";

    // Дата (только дата, без времени)
    // Нормализуем пробел между датой и временем → T для кроссбраузерного парсинга
    if (/^\d{4}-\d{2}-\d{2}/.test(value)) {
      try {
        const iso = value.replace(" ", "T");
        const d = new Date(iso.includes("T") ? iso : iso + "T00:00:00");
        if (!isNaN(d.getTime())) {
          return format(d, "dd.MM.yyyy", { locale: ru });
        }
      } catch { /* ignore */ }
    }

    // Перевод enum-значений
    if (fieldName) {
      const tr = translateEnum(fieldName, value);
      if (tr) return tr;
    }
    // Попробовать по значению без имени поля
    const anyTr = translateEnum("", value);
    if (anyTr) return anyTr;

    return value;
  }

  return String(value);
}

// ─── Вычисление видимых изменений ────────────────────────────────────────────
export interface FieldChange {
  field: string;
  label: string;
  oldVal: unknown;
  newVal: unknown;
  isFK: boolean; // FK-поле (значение UUID, показываем только "изменено")
}

export function computeChanges(
  entry: AuditEntry,
  entityType: string
): FieldChange[] {
  const skip = (f: string) => !isFieldVisible(entityType, f);
  const meta = entry.entityMeta;

  /**
   * Resolve an FK value: if the value is a UUID and entityMeta has an entry
   * for that UUID, return the human-readable name instead.
   * Returns { val, resolved } where resolved=true means we got a real name.
   */
  const resolveFK = (v: unknown): { val: unknown; resolved: boolean } => {
    if (isUUID(v) && meta && typeof v === "string" && meta[v]) {
      return { val: meta[v], resolved: true };
    }
    return { val: v, resolved: false };
  };

  const rawIsFK = (f: string, v: unknown) => isUUID(v) || isUUID(entry.oldData?.[f]);

  const make = (
    field: string,
    oldVal: unknown,
    newVal: unknown
  ): FieldChange => {
    const { val: resolvedOld, resolved: oldResolved } = resolveFK(oldVal);
    const { val: resolvedNew, resolved: newResolved } = resolveFK(newVal);
    const stillFK = !oldResolved && !newResolved && (rawIsFK(field, oldVal) || rawIsFK(field, newVal));
    return {
      field,
      label: getFieldLabel(entityType, field),
      oldVal: resolvedOld,
      newVal: resolvedNew,
      isFK: stillFK,
    };
  };

  // Пустое значение
  const isEmpty = (v: unknown) =>
    v === null || v === undefined || v === "" || v === false;

  if (entry.operation === "DELETE" && entry.oldData) {
    return Object.keys(entry.oldData)
      .filter((f) => !skip(f) && !isEmpty(entry.oldData![f]))
      .map((f) => make(f, entry.oldData![f], null));
  }

  if (entry.operation === "RESTORE" && entry.newData) {
    return Object.keys(entry.newData)
      .filter((f) => !skip(f) && !isEmpty(entry.newData![f]))
      .map((f) => make(f, null, entry.newData![f]));
  }

  if (entry.operation === "CREATE" && entry.newData) {
    return Object.keys(entry.newData)
      .filter((f) => !skip(f) && !isEmpty(entry.newData![f]))
      .map((f) => make(f, null, entry.newData![f]));
  }

  // UPDATE — фильтруем changedFields
  if (entry.changedFields && entry.changedFields.length > 0) {
    return entry.changedFields
      .filter((f) => !skip(f))
      .filter((f) => {
        const o = entry.oldData?.[f];
        const n = entry.newData?.[f];
        // Оба пустых — не показываем
        if (isEmpty(o) && isEmpty(n)) return false;
        // Числа с float-погрешностью — не показываем
        if (areApproxEqual(o, n)) return false;
        return true;
      })
      .map((f) => make(f, entry.oldData?.[f], entry.newData?.[f]));
  }

  // Fallback: changedFields отсутствует (сервер не вычислил diff), но есть данные —
  // показываем все поля, где old и new реально отличаются.
  if (entry.oldData && entry.newData) {
    const allKeys = Array.from(
      new Set([...Object.keys(entry.oldData), ...Object.keys(entry.newData)])
    );
    return allKeys
      .filter((f) => !skip(f))
      .filter((f) => {
        const o = entry.oldData?.[f];
        const n = entry.newData?.[f];
        if (isEmpty(o) && isEmpty(n)) return false;
        if (areApproxEqual(o, n)) return false;
        // Строки — точное сравнение
        if (typeof o === "string" && typeof n === "string" && o === n) return false;
        // Числа с нормализацией
        const oN = normalizeNum(o);
        const nN = normalizeNum(n);
        if (oN !== null && nN !== null && Math.abs(oN - nN) < 1e-5) return false;
        return true;
      })
      .map((f) => make(f, entry.oldData?.[f], entry.newData?.[f]));
  }

  return [];
}

// ─── Переводы типов топлива (используем в summary) ────────────────────────────
const PRODUCT_LABELS: Record<string, string> = {
  kerosene: "Керосин", diesel: "Дизель", pvkj: "ПВКЖ",
  pvkj_tk: "ПВКЖ ТК", gasoline: "Бензин", jet_fuel: "АТФ", mazut: "Мазут",
  service: "Услуга заправки", agent: "Агентское", storage: "Хранение",
};
function prodLabel(pt: unknown): string {
  if (!pt) return "";
  return PRODUCT_LABELS[String(pt)] || String(pt);
}

const MOVE_TYPE_LABELS: Record<string, string> = {
  supply: "Приход", expense: "Расход", transfer: "Переброска", exchange: "Обмен",
  internal: "Внутреннее",
};

/** Форматирует дату кратко (дд.мм.гг) для заголовка строки */
function shortDate(v: unknown): string | null {
  if (!v || typeof v !== "string") return null;
  try {
    const iso = v.replace(" ", "T");
    const d = new Date(iso.includes("T") ? iso : iso + "T00:00:00");
    if (!isNaN(d.getTime())) return format(d, "dd.MM.yy", { locale: ru });
  } catch { /* ignore */ }
  return null;
}

/** Форматирует количество (кг или л) для краткого отображения */
function qtyLabel(kg: unknown, liters: unknown): string {
  const kgN = normalizeNum(kg);
  const lN = normalizeNum(liters);
  if (kgN && kgN > 0)
    return kgN.toLocaleString("ru-RU", { maximumFractionDigits: 0 }) + " кг";
  if (lN && lN > 0)
    return lN.toLocaleString("ru-RU", { maximumFractionDigits: 0 }) + " л";
  return "";
}

/**
 * Возвращает строку-идентификатор сущности для отображения в строке истории.
 * Использует данные записи и entityMeta для резолвинга FK-имён.
 */
export function getEntitySummary(
  entry: AuditEntry,
  entityType: string
): string | null {
  const data =
    entry.operation === "DELETE" ? entry.oldData : entry.newData;
  if (!data) return null;

  const p = (...parts: (string | null | undefined)[]) =>
    parts.filter(Boolean).join(" · ") || null;

  /** Резолвит UUID → имя через entityMeta */
  const resolveName = (uuid: unknown): string | null => {
    if (!uuid || typeof uuid !== "string") return null;
    return entry.entityMeta?.[uuid] || null;
  };

  switch (entityType) {
    case "opt": {
      const supplier = resolveName(data.supplierId);
      const buyer = resolveName(data.buyerId);
      return p(
        shortDate(data.dealDate),
        prodLabel(data.productType),
        qtyLabel(data.quantityKg, data.quantityLiters),
        supplier,
        buyer ? `→ ${buyer}` : null
      );
    }

    case "aircraft_refueling": {
      const supplier = resolveName(data.supplierId);
      const buyer = resolveName(data.buyerId);
      return p(
        shortDate(data.refuelingDate),
        data.aircraftNumber ? String(data.aircraftNumber) : null,
        prodLabel(data.productType),
        qtyLabel(data.quantityKg, data.quantityLiters),
        supplier,
        buyer ? `→ ${buyer}` : null
      );
    }

    case "aircraft_refueling_abroad": {
      const supplier = resolveName(data.supplierId);
      const buyer = resolveName(data.buyerId);
      return p(
        shortDate(data.refuelingDate),
        data.aircraftNumber ? String(data.aircraftNumber) : null,
        prodLabel(data.productType),
        qtyLabel(data.quantityKg, data.quantityLiters),
        supplier,
        buyer ? `→ ${buyer}` : null
      );
    }

    case "movement": {
      const from = resolveName(data.fromWarehouseId);
      const to = resolveName(data.toWarehouseId);
      const supplier = resolveName(data.supplierId);
      const typeStr = data.movementType
        ? (MOVE_TYPE_LABELS[String(data.movementType)] || String(data.movementType))
        : null;
      // Для Прихода (supply) показываем «Поставщик → Склад-получатель»
      let fromTo: string | null = null;
      if (String(data.movementType) === "supply") {
        fromTo = supplier && to ? `${supplier} → ${to}` : to || supplier || null;
      } else {
        fromTo = from && to ? `${from} → ${to}` : from || to || null;
      }
      return p(
        shortDate(data.movementDate),
        typeStr,
        prodLabel(data.productType),
        qtyLabel(data.quantityKg, data.quantityLiters),
        fromTo
      );
    }

    case "exchange":
      return p(
        shortDate(data.exchangeDate),
        prodLabel(data.productType),
        qtyLabel(data.quantityKg, data.quantityLiters)
      );

    case "transportation": {
      const buyer = resolveName(data.buyerId);
      const basis = data.basis ? String(data.basis) : (data.customerBasis ? String(data.customerBasis) : null);
      return p(
        shortDate(data.dealDate),
        prodLabel(data.productType),
        qtyLabel(data.quantityKg, data.quantityLiters),
        buyer,
        basis ? `Базис: ${basis}` : null
      );
    }

    case "equipment_movement": {
      const from = resolveName(data.fromEquipmentId);
      const to = resolveName(data.toEquipmentId);
      const fromTo = from && to ? `${from} → ${to}` : from || to || null;
      const qty = data.quantity ? normalizeNum(data.quantity) : null;
      return p(
        shortDate(data.transactionDate),
        prodLabel(data.productType),
        fromTo,
        qty ? `${qty.toLocaleString("ru-RU")} л` : null
      );
    }

    case "exchange_deals": {
      const wt = normalizeNum(data.weightTon);
      const wtStr = wt ? `${wt.toLocaleString("ru-RU")} т` : null;
      // Продавец: FK supplierId или денормализованное имя
      const seller = resolveName(data.sellerId) || (data.sellerName ? String(data.sellerName) : null);
      // Покупатель: buyerSupplierId (поставщик-покупатель) или buyerId (клиент-покупатель)
      const buyer = resolveName(data.buyerSupplierId) || resolveName(data.buyerId)
        || (data.buyerSupplierName ? String(data.buyerSupplierName) : null);
      return p(
        data.dealNumber ? `#${data.dealNumber}` : null,
        shortDate(data.dealDate),
        seller,
        buyer ? `→ ${buyer}` : null,
        wtStr
      );
    }

    case "prices": {
      const counterparty = resolveName(data.counterpartyId);
      const typeStr = data.counterpartyType
        ? (ENUM_MAP.counterpartyType?.[String(data.counterpartyType)] || String(data.counterpartyType))
        : null;
      const from = data.validFrom ? shortDate(data.validFrom) : null;
      const to = data.validTo ? shortDate(data.validTo) : null;
      const period = from && to ? `${from}–${to}` : from || to || null;
      return p(counterparty || typeStr, prodLabel(data.productType), period);
    }

    case "warehouses":
      return data.name ? String(data.name) : null;

    case "suppliers":
    case "customers":
    case "logistics_carriers":
    case "logistics_delivery_locations":
    case "railway_stations":
      return data.name ? String(data.name) : null;

    case "bases":
      return p(
        data.name ? String(data.name) : null,
        data.iataCode ? String(data.iataCode) : null
      );

    case "logistics_vehicles":
    case "logistics_trailers":
      return p(
        data.licensePlate ? String(data.licensePlate) : null,
        data.model ? String(data.model) : null
      );

    case "logistics_drivers":
      return p(
        data.lastName ? String(data.lastName) : null,
        data.firstName ? String(data.firstName) : null
      );

    case "users":
      return p(
        data.lastName ? String(data.lastName) : null,
        data.firstName ? String(data.firstName) : null,
        data.email ? String(data.email) : null
      );

    case "roles":
      return data.name ? String(data.name) : null;

    case "delivery_cost":
      return p(
        data.fromLocation ? String(data.fromLocation) : null,
        data.toLocation ? `→ ${String(data.toLocation)}` : null
      );

    case "prices": {
      const pt = prodLabel(data.productType);
      const ct = data.counterpartyType
        ? (ENUM_MAP.counterpartyType[String(data.counterpartyType)] || String(data.counterpartyType))
        : null;
      const df = shortDate(data.dateFrom);
      const dt = shortDate(data.dateTo);
      const range = df && dt ? `${df}–${dt}` : df || null;
      return p(pt || null, ct, range);
    }

    case "storage_cards": {
      const ct = data.cardType
        ? (ENUM_MAP.cardType[String(data.cardType)] || String(data.cardType))
        : null;
      return p(data.name ? String(data.name) : null, ct);
    }

    case "exchange_advance_cards": {
      const bal = normalizeNum(data.currentBalance);
      return bal !== null
        ? `Баланс: ${bal.toLocaleString("ru-RU", { maximumFractionDigits: 2 })}`
        : null;
    }

    case "equipment":
      return data.name ? String(data.name) : null;

    case "plan_entries": {
      const tp = data.type
        ? (ENUM_MAP.type[String(data.type)] || String(data.type))
        : null;
      const vol = normalizeNum(data.volume);
      return p(shortDate(data.date), tp, vol ? `${vol.toLocaleString("ru-RU")} т` : null);
    }

    case "logistics_plan_routes":
      return p(
        data.fromEntityName ? String(data.fromEntityName) : null,
        data.toEntityName ? `→ ${String(data.toEntityName)}` : null,
        shortDate(data.dateStart)
      );

    case "logistics_transport_units":
      return shortDate(data.createdAt) || null;

    case "railway_tariffs":
      return p(shortDate(data.validFrom), shortDate(data.validTo));

    case "exchange_rates":
      return p(
        data.currency ? String(data.currency) : null,
        shortDate(data.date)
      );

    default:
      return null;
  }
}

/**
 * Краткое описание изменения для свёрнутой строки:
 * — для UPDATE: список изменённых полей
 * — для CREATE/DELETE/RESTORE: фиксированная фраза
 */
export function changeSummary(
  entry: AuditEntry,
  entityType: string
): string | null {
  if (entry.operation === "CREATE") return null; // идентификатор уже в заголовке
  if (entry.operation === "DELETE") return null;
  if (entry.operation === "RESTORE") return null;

  if (entry.changedFields && entry.changedFields.length > 0) {
    const visible = entry.changedFields.filter(
      (f) =>
        isFieldVisible(entityType, f) &&
        !areApproxEqual(entry.oldData?.[f], entry.newData?.[f])
    );
    if (visible.length === 0) return null;
    const labels = visible.slice(0, 3).map((f) => getFieldLabel(entityType, f));
    const rest = visible.length > 3 ? ` +${visible.length - 3}` : "";
    return labels.join(", ") + rest;
  }
  return null;
}
