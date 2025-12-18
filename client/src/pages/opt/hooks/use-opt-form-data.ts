
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";

interface UseOptFormDataParams {
  supplierId?: string;
  buyerId?: string;
  dealDate?: Date;
  basis?: string;
  carrierId?: string;
  deliveryLocationId?: string;
  warehouseId?: string;
  quantityKg?: number;
}

export function useOptFormData(params: UseOptFormDataParams) {
  const {
    supplierId,
    buyerId,
    dealDate,
    basis,
    carrierId,
    deliveryLocationId,
    warehouseId,
    quantityKg,
  } = params;

  // Получение опций формы (цены, delivery cost, warehouse status)
  const { data: formOptions, isLoading: isLoadingOptions } = useQuery({
    queryKey: [
      "/api/opt/form-options",
      supplierId,
      buyerId,
      dealDate ? format(dealDate, "yyyy-MM-dd") : null,
      basis,
      carrierId,
      deliveryLocationId,
      warehouseId,
    ],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (supplierId) params.append("supplierId", supplierId);
      if (buyerId) params.append("buyerId", buyerId);
      if (dealDate) params.append("dealDate", format(dealDate, "yyyy-MM-dd"));
      if (basis) params.append("basis", basis);
      if (carrierId) params.append("carrierId", carrierId);
      if (deliveryLocationId) params.append("deliveryLocationId", deliveryLocationId);
      if (warehouseId) params.append("warehouseId", warehouseId);

      const response = await fetch(`/api/opt/form-options?${params}`);
      return response.json();
    },
    enabled: !!(supplierId || buyerId),
  });

  // Получение доступных перевозчиков
  const { data: availableCarriers } = useQuery({
    queryKey: ["/api/opt/available-carriers", basis, warehouseId],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (basis) params.append("basis", basis);
      if (warehouseId) params.append("warehouseId", warehouseId);

      const response = await fetch(`/api/opt/available-carriers?${params}`);
      return response.json();
    },
    enabled: !!basis,
  });

  // Получение доступных мест доставки
  const { data: availableLocations } = useQuery({
    queryKey: ["/api/opt/available-delivery-locations", basis, warehouseId, carrierId],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (basis) params.append("basis", basis);
      if (warehouseId) params.append("warehouseId", warehouseId);
      if (carrierId) params.append("carrierId", carrierId);

      const response = await fetch(`/api/opt/available-delivery-locations?${params}`);
      return response.json();
    },
    enabled: !!carrierId,
  });

  // Вычисление финальных значений
  const purchasePrices = formOptions?.purchasePrices || [];
  const salePrices = formOptions?.salePrices || [];
  const deliveryCostPerKg = formOptions?.deliveryCost?.costPerKg || null;
  const warehouseBalance = formOptions?.warehouseStatus?.balance || null;
  const warehouseAverageCost = formOptions?.warehouseStatus?.averageCost || null;

  const deliveryCost = deliveryCostPerKg && quantityKg
    ? parseFloat(deliveryCostPerKg) * quantityKg
    : null;

  return {
    purchasePrices,
    salePrices,
    deliveryCost,
    deliveryCostPerKg,
    warehouseBalance,
    warehouseAverageCost,
    availableCarriers: availableCarriers || [],
    availableLocations: availableLocations || [],
    isLoadingOptions,
  };
}
