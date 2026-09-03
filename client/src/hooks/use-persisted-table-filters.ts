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
 * Вспомогательная функция — строит строку параметров запроса из columnFilters.
 * Обрабатывает специальные маркеры дат:
 *   __range__:YYYY-MM-DD:YYYY-MM-DD — диапазон дат (отправляется как dateFrom/dateTo)
 *   __month__:YYYY-MM              — целый месяц (отправляется как dateFrom/dateTo)
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
        if (v.startsWith("__range__:")) {
          // format: __range__:YYYY-MM-DD:YYYY-MM-DD
          const rest = v.slice("__range__:".length); // YYYY-MM-DD:YYYY-MM-DD
          const sepIdx = rest.indexOf(":");
          if (sepIdx !== -1) {
            dateFrom = rest.slice(0, sepIdx);
            dateTo = rest.slice(sepIdx + 1);
          }
        } else if (v.startsWith("__month__:")) {
          // format: __month__:YYYY-MM
          const ym = v.slice("__month__:".length); // YYYY-MM
          const [y, m] = ym.split("-");
          if (y && m) {
            dateFrom = `${y}-${m}-01`;
            const lastDay = new Date(parseInt(y), parseInt(m), 0).getDate();
            dateTo = `${y}-${m}-${String(lastDay).padStart(2, "0")}`;
          }
        } else {
          regularDates.push(v);
        }
      });
      if (regularDates.length) {
        parts.push(`filter_date=${encodeURIComponent(regularDates.join(","))}`);
      }
    } else {
      parts.push(`filter_${columnId}=${encodeURIComponent(values.join(","))}`);
    }
  });

  if (dateFrom) parts.push(`dateFrom=${dateFrom}`);
  if (dateTo) parts.push(`dateTo=${dateTo}`);

  return parts.length ? "&" + parts.join("&") : "";
}
