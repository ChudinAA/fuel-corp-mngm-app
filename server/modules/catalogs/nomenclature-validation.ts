import { PRODUCT_TYPE } from "@shared/constants";

const productTypesWithNomenclature = new Set<string>([
  PRODUCT_TYPE.KEROSENE,
  PRODUCT_TYPE.PVKJ,
  PRODUCT_TYPE.SERVICE,
]);

type NomenclatureRecord = {
  productType: string | null;
};

type NomenclatureLookup = (
  id: string,
) => Promise<NomenclatureRecord | null | undefined>;

type NomenclatureFields = {
  productType?: unknown;
  nomenclatureId?: unknown;
};

function optionalString(value: unknown): string | null | undefined {
  if (value === null || value === undefined) return value;
  return typeof value === "string" ? value : String(value);
}

export async function getOperationNomenclatureError(
  data: {
    productType?: string | null;
    nomenclatureId?: string | null;
  },
  lookup: NomenclatureLookup,
  required = true,
): Promise<string | null> {
  const productType = data.productType?.trim();
  const nomenclatureId = data.nomenclatureId?.trim();

  if (!productType) {
    return required || nomenclatureId ? "Тип продукта обязателен" : null;
  }

  if (!nomenclatureId) {
    return required && productTypesWithNomenclature.has(productType)
      ? "Выберите номенклатуру"
      : null;
  }

  const item = await lookup(nomenclatureId);
  if (!item) {
    return "Выбранная номенклатура не найдена или удалена";
  }
  if (item.productType !== productType) {
    return "Номенклатура не соответствует выбранному типу продукта";
  }

  return null;
}

export async function getOperationNomenclatureUpdateError(
  current: NomenclatureFields | null | undefined,
  patch: NomenclatureFields,
  lookup: NomenclatureLookup,
): Promise<string | null> {
  if (!current) {
    return getOperationNomenclatureError(
      {
        productType: optionalString(patch.productType),
        nomenclatureId: optionalString(patch.nomenclatureId),
      },
      lookup,
    );
  }

  const currentProductType = optionalString(current.productType);
  const currentNomenclatureId = optionalString(current.nomenclatureId);
  const productType =
    patch.productType === undefined
      ? currentProductType
      : optionalString(patch.productType);
  const productTypeChanged = productType !== currentProductType;
  const patchIncludesNomenclatureId = patch.nomenclatureId !== undefined;
  const nomenclatureId = patchIncludesNomenclatureId
    ? optionalString(patch.nomenclatureId)
    : currentNomenclatureId;
  const unchangedLegacyEmpty =
    currentNomenclatureId == null &&
    nomenclatureId == null &&
    !productTypeChanged;

  return getOperationNomenclatureError(
    { productType, nomenclatureId },
    lookup,
    !unchangedLegacyEmpty,
  );
}
