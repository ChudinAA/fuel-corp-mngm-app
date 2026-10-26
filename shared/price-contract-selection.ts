import { COUNTERPARTY_TYPE } from "./constants";

export interface PriceContractCandidate {
  id: string;
  contractDate?: string | Date | null;
  createdAt?: string | Date | null;
  contractNumber: string;
  parentContractId?: string | null;
}

const numberOrder = new Intl.Collator("ru", { numeric: true, sensitivity: "base" });

/** Contract date is authoritative; creation time is only a fallback for undated records. */
export function getLatestPriceContract<T extends PriceContractCandidate>(contracts: T[]): T | undefined {
  if (!contracts.length) return undefined;
  const dateKey = (item: T) => {
    const value = item.contractDate || item.createdAt;
    if (!value) return "";
    return (value instanceof Date ? value.toISOString() : value).slice(0, 10);
  };
  const sorted = [...contracts].sort((a, b) =>
    dateKey(b).localeCompare(dateKey(a)) ||
    numberOrder.compare(b.contractNumber, a.contractNumber) ||
    Number(Boolean(b.parentContractId)) - Number(Boolean(a.parentContractId)) ||
    a.id.localeCompare(b.id),
  );
  const newest = sorted.filter((item) => dateKey(item) === dateKey(sorted[0]));
  const supersededParents = new Set(newest.map((item) => item.parentContractId).filter(Boolean));
  return newest.find((item) => !supersededParents.has(item.id));
}

export function isPriceContractRequired(counterpartyType: string): boolean {
  return counterpartyType !== COUNTERPARTY_TYPE.REFUELING_ABROAD;
}
