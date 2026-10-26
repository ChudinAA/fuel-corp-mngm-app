interface ContractHintProps {
  contractNumber?: string | null;
  contractName?: string | null;
}

/** Compact, fixed-height contract context for a selected trade price. */
export function ContractHint({ contractNumber, contractName }: ContractHintProps) {
  const text = [contractNumber ? `Договор ${contractNumber}` : "", contractName]
    .filter(Boolean)
    .join(" · ");

  return (
    <div
      className="min-h-4 h-4 truncate text-xs leading-4 text-muted-foreground"
      title={text || undefined}
      aria-label={text || "Договор не указан"}
    >
      {text || "\u00a0"}
    </div>
  );
}

export function getSelectedPriceContract<T extends {
  id: string;
  contractNumber?: string | null;
  contractName?: string | null;
}>(prices: T[], selectedId?: string | null): T | undefined {
  if (!selectedId) return undefined;
  const exactMatch = prices.find((price) => price.id === selectedId);
  if (exactMatch) return exactMatch;
  const composite = selectedId.match(/^(.*)-(\d+)$/);
  const priceId = composite?.[1] ?? selectedId;
  return prices.find((price) => price.id === priceId);
}
