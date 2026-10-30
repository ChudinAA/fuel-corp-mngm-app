type Item = { id: string; productType?: string | null; isDefault?: boolean };

export function shouldPreserveLegacyNomenclatureSelection({
  isEditing,
  currentNomenclatureId,
  currentProductType,
  originalProductType,
}: {
  isEditing: boolean;
  currentNomenclatureId?: string | null;
  currentProductType?: string | null;
  originalProductType?: string | null;
}): boolean {
  return (
    isEditing &&
    !currentNomenclatureId &&
    Boolean(currentProductType) &&
    currentProductType === originalProductType
  );
}

/** undefined means no write: especially important while loading or when the list is empty. */
export function getNomenclatureSelection(
  items: Item[],
  productType: string,
  current: string | null | undefined,
  loaded: boolean,
  preserveLegacy = false,
): string | undefined {
  if (!loaded || (preserveLegacy && !current)) return undefined;
  const options = items.filter((item) => item.productType === productType);
  if (options.some((item) => item.id === current)) return undefined;
  const next = options.find((item) => item.isDefault)?.id || "";
  return next === (current || "") ? undefined : next;
}
