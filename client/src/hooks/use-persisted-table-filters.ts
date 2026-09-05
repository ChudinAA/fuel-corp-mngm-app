import { useState, useCallback } from "react";

function readStorage<T>(key: string, defaultValue: T): T {
  try {
    const item = localStorage.getItem(key);
    return item !== null ? (JSON.parse(item) as T) : defaultValue;
  } catch {
    return defaultValue;
  }
}

function writeStorage<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // ignore quota errors
  }
}

/**
 * Хук для хранения состояния фильтров таблицы в localStorage.
 * При навигации между страницами фильтры сохраняются.
 *
 * @param storageKey — уникальный ключ для страницы, например "table-filters:refueling"
 */
export function usePersistedTableFilters(storageKey: string) {
  const filtersKey = `${storageKey}:filters`;
  const searchKey = `${storageKey}:search`;

  const [columnFilters, setColumnFiltersState] = useState<Record<string, string[]>>(
    () => readStorage<Record<string, string[]>>(filtersKey, {}),
  );

  const [search, setSearchState] = useState<string>(
    () => readStorage<string>(searchKey, ""),
  );

  const setColumnFilters = useCallback(
    (next: Record<string, string[]> | ((prev: Record<string, string[]>) => Record<string, string[]>)) => {
      setColumnFiltersState((prev) => {
        const value = typeof next === "function" ? next(prev) : next;
        writeStorage(filtersKey, value);
        return value;
      });
    },
    [filtersKey],
  );

  const setSearch = useCallback(
    (value: string) => {
      setSearchState(value);
      writeStorage(searchKey, value);
    },
    [searchKey],
  );

  return { columnFilters, setColumnFilters, search, setSearch };
}

/**
 * Разбирает маркер диапазона дат "__range__:YYYY-MM-DD:YYYY-MM-DD"
 * или месяца "__month__:YYYY-MM" и возвращает {from, to} или null.
 */
function parseDateMarker(v: string): { from: string; to: string } | null {
  if (v.startsWith("__range__:")) {
    const rest = v.slice("__range__:".length);
    const sepIdx = rest.indexOf(":");
    if (sepIdx !== -1) {
      return { from: rest.slice(0, sepIdx), to: rest.slice(sepIdx + 1) };
    }
  } else if (v.startsWith("__month__:")) {
    const ym = v.slice("__month__:".length);
    const [y, m] = ym.split("-");
    if (y && m) {
      const from = `${y}-${m}-01`;
      const lastDay = new Date(parseInt(y), parseInt(m), 0).getDate();
      const to = `${y}-${m}-${String(lastDay).padStart(2, "0")}`;
      return { from, to };
    }
  }
  return null;
}

/**
 * Вспомогательная функция — строит строку параметров запроса из columnFilters.
 * Обрабатывает специальные маркеры дат:
 *   __range__:YYYY-MM-DD:YYYY-MM-DD — диапазон дат
 *   __month__:YYYY-MM              — целый месяц
 *
 * Для колонки "date" генерирует dateFrom/dateTo.
 * Для любых других колонок с датовыми маркерами генерирует <col>DateFrom/<col>DateTo.
 */
export function buildFilterQueryString(columnFilters: Record<string, string[]>): string {
  const parts: string[] = [];
  let dateFrom: string | undefined;
  let dateTo: string | undefined;

  Object.entries(columnFilters).forEach(([columnId, values]) => {
    if (!values.length) return;

    if (columnId === "date") {
      const regularDates: string[] = [];
      values.forEach((v) => {
        const parsed = parseDateMarker(v);
        if (parsed) {
          dateFrom = parsed.from;
          dateTo = parsed.to;
        } else {
          regularDates.push(v);
        }
      });
      if (regularDates.length) {
        parts.push(`filter_date=${encodeURIComponent(regularDates.join(","))}`);
      }
    } else {
      // Для остальных колонок — проверяем маркеры дат и обычные значения
      const regularVals: string[] = [];
      let colDateFrom: string | undefined;
      let colDateTo: string | undefined;

      values.forEach((v) => {
        const parsed = parseDateMarker(v);
        if (parsed) {
          colDateFrom = parsed.from;
          colDateTo = parsed.to;
        } else {
          regularVals.push(v);
        }
      });

      if (regularVals.length) {
        parts.push(`filter_${columnId}=${encodeURIComponent(regularVals.join(","))}`);
      }
      // Генерируем <columnId>From / <columnId>To для дат, кроме "date" (у него dateFrom/dateTo)
      if (colDateFrom) parts.push(`${columnId}From=${colDateFrom}`);
      if (colDateTo) parts.push(`${columnId}To=${colDateTo}`);
    }
  });

  if (dateFrom) parts.push(`dateFrom=${dateFrom}`);
  if (dateTo) parts.push(`dateTo=${dateTo}`);

  return parts.length ? "&" + parts.join("&") : "";
}
