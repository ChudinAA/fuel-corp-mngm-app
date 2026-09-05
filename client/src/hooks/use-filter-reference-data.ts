import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";

const STALE_TIME = 5 * 60 * 1000;

type Option = { label: string; value: string };

export interface UseFilterReferenceDataOptions {
  /** Все поставщики */
  suppliers?: boolean;
  /** Только поставщики с оптовыми базисами */
  wholesaleSuppliers?: boolean;
  /** Только поставщики с базисами заправки */
  refuelingSuppliers?: boolean;
  /** Только зарубежные поставщики (isForeign=true) */
  abroadSuppliers?: boolean;
  /** Все покупатели */
  customers?: boolean;
  /** Только зарубежные покупатели (isForeign=true) */
  abroadCustomers?: boolean;
  /** Все базисы */
  bases?: boolean;
  /** Только оптовые базисы */
  wholesaleBases?: boolean;
  /** Только базисы заправки */
  refuelingBases?: boolean;
  /** Только зарубежные базисы */
  abroadBases?: boolean;
  /** Перевозчики */
  carriers?: boolean;
  /** Склады */
  warehouses?: boolean;
  /** Средства заправки (СЗ) */
  equipment?: boolean;
}

function toNameOptions(items: any[]): Option[] {
  return items
    .filter((i: any) => i?.name)
    .map((i: any) => ({ label: i.name as string, value: i.name as string }))
    .sort((a, b) => a.label.localeCompare(b.label, "ru"));
}

/**
 * Общий хук для загрузки данных справочников для фильтров таблиц.
 * Кэшируется на 5 минут, данные запрашиваются только при необходимости.
 */
export function useFilterReferenceData(opts: UseFilterReferenceDataOptions = {}) {
  const needSuppliers =
    opts.suppliers ||
    opts.wholesaleSuppliers ||
    opts.refuelingSuppliers ||
    opts.abroadSuppliers;
  const needBases =
    opts.wholesaleSuppliers ||
    opts.refuelingSuppliers ||
    opts.bases ||
    opts.wholesaleBases ||
    opts.refuelingBases ||
    opts.abroadBases;
  const needCustomers = opts.customers || opts.abroadCustomers;

  const { data: allSuppliers = [] } = useQuery<any[]>({
    queryKey: ["/api/suppliers"],
    staleTime: STALE_TIME,
    enabled: !!needSuppliers,
  });

  const { data: allBases = [] } = useQuery<any[]>({
    queryKey: ["/api/bases"],
    staleTime: STALE_TIME,
    enabled: !!needBases,
  });

  const { data: allCustomers = [] } = useQuery<any[]>({
    queryKey: ["/api/customers"],
    staleTime: STALE_TIME,
    enabled: !!needCustomers,
  });

  const { data: allCarriers = [] } = useQuery<any[]>({
    queryKey: ["/api/logistics/carriers"],
    staleTime: STALE_TIME,
    enabled: !!opts.carriers,
  });

  const { data: allWarehouses = [] } = useQuery<any[]>({
    queryKey: ["/api/warehouses"],
    staleTime: STALE_TIME,
    enabled: !!opts.warehouses,
  });

  const { data: allEquipment = [] } = useQuery<any[]>({
    queryKey: ["/api/warehouses-equipment"],
    staleTime: STALE_TIME,
    enabled: !!opts.equipment,
  });

  // --- Supplier options ---
  const supplierOptions = useMemo(
    () => (opts.suppliers ? toNameOptions(allSuppliers) : []),
    [allSuppliers, opts.suppliers],
  );

  const wholesaleSupplierOptions = useMemo(() => {
    if (!opts.wholesaleSuppliers) return [];
    const wholesaleBaseIds = new Set(
      allBases
        .filter((b: any) => b.baseType === "wholesale")
        .map((b: any) => b.id as string),
    );
    return toNameOptions(
      allSuppliers.filter(
        (s: any) =>
          Array.isArray(s.baseIds) &&
          s.baseIds.some((id: string) => wholesaleBaseIds.has(id)),
      ),
    );
  }, [allSuppliers, allBases, opts.wholesaleSuppliers]);

  const refuelingSupplierOptions = useMemo(() => {
    if (!opts.refuelingSuppliers) return [];
    const refuelingBaseIds = new Set(
      allBases
        .filter((b: any) => b.baseType === "refueling")
        .map((b: any) => b.id as string),
    );
    return toNameOptions(
      allSuppliers.filter(
        (s: any) =>
          Array.isArray(s.baseIds) &&
          s.baseIds.some((id: string) => refuelingBaseIds.has(id)),
      ),
    );
  }, [allSuppliers, allBases, opts.refuelingSuppliers]);

  const abroadSupplierOptions = useMemo(
    () =>
      opts.abroadSuppliers
        ? toNameOptions(allSuppliers.filter((s: any) => s.isForeign))
        : [],
    [allSuppliers, opts.abroadSuppliers],
  );

  // --- Customer options ---
  const customerOptions = useMemo(
    () => (opts.customers ? toNameOptions(allCustomers) : []),
    [allCustomers, opts.customers],
  );

  const abroadCustomerOptions = useMemo(
    () =>
      opts.abroadCustomers
        ? toNameOptions(allCustomers.filter((c: any) => c.isForeign))
        : [],
    [allCustomers, opts.abroadCustomers],
  );

  // --- Base options ---
  const baseOptions = useMemo(
    () => (opts.bases ? toNameOptions(allBases) : []),
    [allBases, opts.bases],
  );

  const wholesaleBaseOptions = useMemo(
    () =>
      opts.wholesaleBases
        ? toNameOptions(allBases.filter((b: any) => b.baseType === "wholesale"))
        : [],
    [allBases, opts.wholesaleBases],
  );

  const refuelingBaseOptions = useMemo(
    () =>
      opts.refuelingBases
        ? toNameOptions(allBases.filter((b: any) => b.baseType === "refueling"))
        : [],
    [allBases, opts.refuelingBases],
  );

  const abroadBaseOptions = useMemo(
    () =>
      opts.abroadBases
        ? toNameOptions(allBases.filter((b: any) => b.baseType === "abroad"))
        : [],
    [allBases, opts.abroadBases],
  );

  // --- Carrier options ---
  const carrierOptions = useMemo(
    () => (opts.carriers ? toNameOptions(allCarriers) : []),
    [allCarriers, opts.carriers],
  );

  // --- Warehouse options ---
  const warehouseOptions = useMemo(
    () => (opts.warehouses ? toNameOptions(allWarehouses) : []),
    [allWarehouses, opts.warehouses],
  );

  // --- Equipment options ---
  const equipmentOptions = useMemo(
    () => (opts.equipment ? toNameOptions(allEquipment) : []),
    [allEquipment, opts.equipment],
  );

  return {
    supplierOptions,
    wholesaleSupplierOptions,
    refuelingSupplierOptions,
    abroadSupplierOptions,
    customerOptions,
    abroadCustomerOptions,
    baseOptions,
    wholesaleBaseOptions,
    refuelingBaseOptions,
    abroadBaseOptions,
    carrierOptions,
    warehouseOptions,
    equipmentOptions,
    // Raw data for custom processing
    allSuppliers,
    allCustomers,
    allBases,
    allCarriers,
    allWarehouses,
    allEquipment,
  };
}
