import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { PRODUCT_TYPE, COUNTERPARTY_TYPE, COUNTERPARTY_ROLE, BASE_TYPE, CUSTOMER_MODULE } from "@shared/constants";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { CalendarIcon, Plus, Loader2, AlertCircle } from "lucide-react";
import type { Supplier, Base, Customer, Warehouse, Price } from "@shared/schema";
import { CalculatedField } from "../calculated-field";
import { refuelingFormSchema, type RefuelingFormData } from "../schemas";
import { formatNumber, formatCurrency } from "../utils";
import type { RefuelingFormProps } from "../types";
import { PRODUCT_TYPES } from "../constants";
import { RefuelingMainFields } from "./refueling-main-fields";
import { RefuelingPricingSection } from "./refueling-pricing-section";
import { VolumeInputSection } from "./refueling-form-sections";
import { useRefuelingCalculations } from "../hooks/use-refueling-calculations";
import { useRefuelingFilters } from "../hooks/use-refueling-filters";


export function RefuelingForm({ 
  onSuccess, 
  editData 
}: RefuelingFormProps) {
  const { toast } = useToast();
  const [inputMode, setInputMode] = useState<"liters" | "kg">("liters");
  const [selectedBasis, setSelectedBasis] = useState<string>("");
  const [selectedPurchasePriceId, setSelectedPurchasePriceId] = useState<string>("");
  const [selectedSalePriceId, setSelectedSalePriceId] = useState<string>("");
  const [initialWarehouseBalance, setInitialWarehouseBalance] = useState<number>(0); // State for initial balance
  const isEditing = !!editData;

  const form = useForm<RefuelingFormData>({
    resolver: zodResolver(refuelingFormSchema),
    defaultValues: {
      refuelingDate: editData ? new Date(editData.refuelingDate) : new Date(),
      productType: PRODUCT_TYPE.KEROSENE,
      aircraftNumber: "",
      orderNumber: "",
      supplierId: "",
      buyerId: "",
      warehouseId: "",
      inputMode: "liters",
      quantityLiters: "",
      density: "",
      quantityKg: "",
      notes: "",
      isApproxVolume: false,
      selectedPurchasePriceId: "",
      selectedSalePriceId: "",
      basis: "",
    },
  });

  const { data: suppliers } = useQuery<Supplier[]>({
    queryKey: ["/api/suppliers"],
  });

  const { data: allBases } = useQuery<Base[]>({
    queryKey: ["/api/bases"],
  });

  const { data: allPrices } = useQuery<Price[]>({
    queryKey: ["/api/prices"],
  });

  const { data: warehouses } = useQuery<Warehouse[]>({
    queryKey: ["/api/warehouses"],
  });

  const { data: customers } = useQuery<Customer[]>({
    queryKey: ["/api/customers"],
  });

  const watchSupplierId = form.watch("supplierId");
  const watchBuyerId = form.watch("buyerId");
  const watchRefuelingDate = form.watch("refuelingDate");
  const watchLiters = form.watch("quantityLiters");
  const watchDensity = form.watch("density");
  const watchKg = form.watch("quantityKg");
  const watchProductType = form.watch("productType");

  const selectedSupplier = suppliers?.find(s => s.id === watchSupplierId);
  const isWarehouseSupplier = selectedSupplier?.isWarehouse || false;
  const supplierWarehouse = warehouses?.find(w => 
    w.supplierId === watchSupplierId
  );

  // Use filtering hook
  const {
    refuelingSuppliers,
    availableBases,
    purchasePrices,
    salePrices,
  } = useRefuelingFilters({
    supplierId: watchSupplierId,
    buyerId: watchBuyerId,
    refuelingDate: watchRefuelingDate,
    selectedBasis,
    productType: watchProductType,
    allPrices,
    suppliers,
    allBases,
  });

  // Use calculations hook
  const {
    calculatedKg,
    finalKg,
    purchasePrice,
    salePrice,
    purchaseAmount,
    saleAmount,
    agentFee,
    profit,
    warehouseStatus,
  } = useRefuelingCalculations({
    inputMode,
    quantityLiters: watchLiters,
    density: watchDensity,
    quantityKg: watchKg,
    isWarehouseSupplier,
    supplierWarehouse,
    selectedBasis,
    purchasePrices,
    salePrices,
    selectedPurchasePriceId,
    selectedSalePriceId,
    selectedSupplier,
    productType: watchProductType,
    isEditing,
    initialWarehouseBalance, // Pass the initial balance
  });

  useEffect(() => {
    if (watchSupplierId && suppliers && allBases) {
      const supplier = suppliers.find(s => s.id === watchSupplierId);

      if (supplier?.isWarehouse) {
        const warehouse = warehouses?.find(w => 
          w.supplierId === supplier.id
        );
        if (warehouse) {
          form.setValue("warehouseId", warehouse.id);
        }
      } else {
        form.setValue("warehouseId", "");
      }

      // Автоматически выбираем первый базис
      if (!editData && supplier?.baseIds && supplier.baseIds.length >= 1) {
        const baseId = supplier.baseIds[0];
        const base = allBases.find(b => b.id === baseId && b.baseType === BASE_TYPE.REFUELING);
        if (base) {
          form.setValue("basis", base.name);
          setSelectedBasis(base.name);
        }
      }
    }
  }, [watchSupplierId, suppliers, allBases, warehouses, form, editData]);

  useEffect(() => {
    if (editData && suppliers && customers && allBases && warehouses) { // Added warehouses dependency
      const supplier = suppliers.find(s => s.name === editData.supplierId || s.id === editData.supplierId);
      const buyer = customers.find(c => c.name === editData.buyerId || c.id === editData.buyerId);

      // Construct composite price IDs with indices
      const purchasePriceCompositeId = editData.purchasePriceId && editData.purchasePriceIndex !== undefined
        ? `${editData.purchasePriceId}-${editData.purchasePriceIndex}`
        : editData.purchasePriceId || "";
      
      const salePriceCompositeId = editData.salePriceId && editData.salePriceIndex !== undefined
        ? `${editData.salePriceId}-${editData.salePriceIndex}`
        : editData.salePriceId || "";

      // Сохраняем изначальный остаток на складе (с учетом текущей сделки)
      if (editData.warehouseId) {
        const warehouse = warehouses.find(w => w.id === editData.warehouseId);
        if (warehouse) {
          // Determine the correct balance based on product type
          const currentBalance = watchProductType === PRODUCT_TYPE.PVKJ 
            ? parseFloat(warehouse.pvkjBalance || "0")
            : parseFloat(warehouse.currentBalance || "0");
          const dealQuantity = parseFloat(editData.quantityKg || "0"); // Assuming quantityKg is the relevant quantity for balance adjustment
          setInitialWarehouseBalance(currentBalance + dealQuantity);
        }
      }

      form.reset({
        refuelingDate: new Date(editData.refuelingDate),
        productType: editData.productType,
        aircraftNumber: editData.aircraftNumber || "",
        orderNumber: editData.orderNumber || "",
        supplierId: supplier?.id || "",
        buyerId: buyer?.id || "",
        warehouseId: editData.warehouseId || "",
        inputMode: editData.quantityLiters ? "liters" : "kg",
        quantityLiters: editData.quantityLiters || "",
        density: editData.density || "",
        quantityKg: editData.quantityKg || "",
        notes: editData.notes || "",
        isApproxVolume: editData.isApproxVolume || false,
        selectedPurchasePriceId: purchasePriceCompositeId,
        selectedSalePriceId: salePriceCompositeId,
        basis: editData.basis || "",
      });

      setSelectedPurchasePriceId(purchasePriceCompositeId);
      setSelectedSalePriceId(salePriceCompositeId);
      
      // Set basis from editData
      if (editData.basis) {
        setSelectedBasis(editData.basis);
      }

      if (editData.quantityLiters) {
        setInputMode("liters");
      }
    }
  }, [editData, suppliers, customers, allBases, warehouses, form, watchProductType]); // Added watchProductType dependency


  const createMutation = useMutation({
    mutationFn: async (data: RefuelingFormData) => {
      // Извлекаем ID цены и индекс из составного ID
      let purchasePriceId = null;
      let purchasePriceIndex = 0;
      
      if (!isWarehouseSupplier && selectedPurchasePriceId) {
        const parts = selectedPurchasePriceId.split('-');
        if (parts.length >= 5) {
          purchasePriceIndex = parseInt(parts[parts.length - 1]);
          purchasePriceId = parts.slice(0, -1).join('-');
        } else {
          purchasePriceId = selectedPurchasePriceId;
        }
      } else if (!isWarehouseSupplier && purchasePrices.length > 0) {
        purchasePriceId = purchasePrices[0].id;
        purchasePriceIndex = 0;
      }
      
      let salePriceId = null;
      let salePriceIndex = 0;
      
      if (selectedSalePriceId) {
        const parts = selectedSalePriceId.split('-');
        if (parts.length >= 5) {
          salePriceIndex = parseInt(parts[parts.length - 1]);
          salePriceId = parts.slice(0, -1).join('-');
        } else {
          salePriceId = selectedSalePriceId;
        }
      } else if (salePrices.length > 0) {
        salePriceId = salePrices[0].id;
        salePriceIndex = 0;
      }

      const payload = {
        ...data,
        supplierId: data.supplierId,
        buyerId: data.buyerId,
        warehouseId: isWarehouseSupplier && supplierWarehouse ? supplierWarehouse.id : null,
        basis: String(selectedBasis || ""), // Use selectedBasis
        refuelingDate: format(data.refuelingDate, "yyyy-MM-dd"),
        quantityKg: String(parseFloat(calculatedKg)),
        quantityLiters: data.quantityLiters ? String(parseFloat(data.quantityLiters)) : null,
        density: data.density ? String(parseFloat(data.density)) : null,
        purchasePrice: purchasePrice !== null ? String(purchasePrice) : null,
        purchasePriceId: purchasePriceId,
        purchasePriceIndex: purchasePriceIndex,
        salePrice: salePrice !== null ? String(salePrice) : null,
        salePriceId: salePriceId,
        salePriceIndex: salePriceIndex,
        purchaseAmount: purchaseAmount !== null ? String(purchaseAmount) : null,
        saleAmount: saleAmount !== null ? String(saleAmount) : null,
        profit: profit !== null ? String(profit) : null,
      };
      const res = await apiRequest("POST", "/api/refueling", payload);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ 
        predicate: (query) => {
          const key = query.queryKey[0] as string;
          return key?.startsWith('/api/refueling') || key?.startsWith('/api/warehouses');
        }
      });
      toast({ title: "Заправка создана", description: "Заправка ВС успешно сохранена" });
      form.reset();
      setSelectedPurchasePriceId("");
      setSelectedSalePriceId("");
      setSelectedBasis("");
      onSuccess?.();
    },
    onError: (error: Error) => {
      toast({ 
        title: "Ошибка", 
        description: error.message, 
        variant: "destructive" 
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: RefuelingFormData & { id: string }) => {
      // Извлекаем ID цены и индекс из составного ID
      let purchasePriceId = null;
      let purchasePriceIndex = 0;
      
      if (!isWarehouseSupplier && selectedPurchasePriceId) {
        const parts = selectedPurchasePriceId.split('-');
        if (parts.length >= 5) {
          purchasePriceIndex = parseInt(parts[parts.length - 1]);
          purchasePriceId = parts.slice(0, -1).join('-');
        } else {
          purchasePriceId = selectedPurchasePriceId;
        }
      } else if (!isWarehouseSupplier && purchasePrices.length > 0) {
        purchasePriceId = purchasePrices[0].id;
        purchasePriceIndex = 0;
      }
      
      let salePriceId = null;
      let salePriceIndex = 0;
      
      if (selectedSalePriceId) {
        const parts = selectedSalePriceId.split('-');
        if (parts.length >= 5) {
          salePriceIndex = parseInt(parts[parts.length - 1]);
          salePriceId = parts.slice(0, -1).join('-');
        } else {
          salePriceId = selectedSalePriceId;
        }
      } else if (salePrices.length > 0) {
        salePriceId = salePrices[0].id;
        salePriceIndex = 0;
      }

      const payload = {
        ...data,
        supplierId: data.supplierId,
        buyerId: data.buyerId,
        warehouseId: isWarehouseSupplier && supplierWarehouse ? supplierWarehouse.id : null,
        basis: String(selectedBasis || ""), // Use selectedBasis
        refuelingDate: format(data.refuelingDate, "yyyy-MM-dd"),
        quantityKg: String(parseFloat(calculatedKg)),
        quantityLiters: data.quantityLiters ? String(parseFloat(data.quantityLiters)) : null,
        density: data.density ? String(parseFloat(data.density)) : null,
        purchasePrice: purchasePrice !== null ? String(purchasePrice) : null,
        purchasePriceId: purchasePriceId,
        purchasePriceIndex: purchasePriceIndex,
        salePrice: salePrice !== null ? String(salePrice) : null,
        salePriceId: salePriceId,
        salePriceIndex: salePriceIndex,
        purchaseAmount: purchaseAmount !== null ? String(purchaseAmount) : null,
        saleAmount: saleAmount !== null ? String(saleAmount) : null,
        profit: profit !== null ? String(profit) : null,
      };
      const res = await apiRequest("PATCH", `/api/refueling/${data.id}`, payload);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ 
        predicate: (query) => {
          const key = query.queryKey[0] as string;
          return key?.startsWith('/api/refueling') || key?.startsWith('/api/warehouses');
        }
      });
      toast({ title: "Заправка обновлена", description: "Заправка ВС успешно обновлена" });
      form.reset();
      setSelectedPurchasePriceId("");
      setSelectedSalePriceId("");
      setSelectedBasis("");
      onSuccess?.();
    },
    onError: (error: Error) => {
      toast({ 
        title: "Ошибка", 
        description: error.message, 
        variant: "destructive" 
      });
    },
  });

  const onSubmit = (data: RefuelingFormData) => {
    if (editData) {
      updateMutation.mutate({ ...data, id: editData.id });
    } else {
      createMutation.mutate(data);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <RefuelingMainFields
          form={form}
          refuelingSuppliers={refuelingSuppliers}
          customers={customers}
          selectedSupplier={selectedSupplier}
          selectedBasis={selectedBasis}
          setSelectedBasis={setSelectedBasis}
          availableBases={availableBases}
        />

        <VolumeInputSection
          form={form}
          inputMode={inputMode}
          setInputMode={setInputMode}
          calculatedKg={calculatedKg}
        />

        <RefuelingPricingSection
          form={form}
          isWarehouseSupplier={isWarehouseSupplier}
          purchasePrices={purchasePrices}
          salePrices={salePrices}
          selectedPurchasePriceId={selectedPurchasePriceId}
          selectedSalePriceId={selectedSalePriceId}
          setSelectedPurchasePriceId={setSelectedPurchasePriceId}
          setSelectedSalePriceId={setSelectedSalePriceId}
          purchasePrice={purchasePrice}
          salePrice={salePrice}
          purchaseAmount={purchaseAmount}
          saleAmount={saleAmount}
          profit={profit}
          agentFee={agentFee}
          warehouseStatus={warehouseStatus}
          productType={watchProductType}
        />

        <div className="grid gap-4 md:grid-cols-1">
          <FormField
            control={form.control}
            name="notes"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Примечания</FormLabel>
                <FormControl>
                  <Textarea 
                    placeholder="Дополнительная информация..."
                    className="resize-none"
                    data-testid="input-notes"
                    {...field} 
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="isApproxVolume"
            render={({ field }) => (
              <FormItem className="flex items-center gap-2 space-y-0">
                <FormControl>
                  <Checkbox
                    checked={field.value}
                    onCheckedChange={field.onChange}
                    data-testid="checkbox-approx-volume"
                  />
                </FormControl>
                <FormLabel className="text-sm font-normal cursor-pointer">
                  Примерный объем (требует уточнения)
                </FormLabel>
              </FormItem>
            )}
          />
        </div>

        <div className="flex justify-end gap-4 pt-4 border-t">
          <Button 
            type="button" 
            variant="outline"
            onClick={() => {
              form.reset();
              setSelectedPurchasePriceId("");
              setSelectedSalePriceId("");
              setSelectedBasis("");
              onSuccess?.();
            }}
          >
            {editData ? "Отмена" : "Очистить"}
          </Button>
          <Button 
            type="submit" 
            disabled={createMutation.isPending || updateMutation.isPending}
            data-testid="button-submit-refueling"
          >
            {createMutation.isPending || updateMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {editData ? "Сохранение..." : "Создание..."}
              </>
            ) : (
              <>
                <Plus className="mr-2 h-4 w-4" />
                {editData ? "Сохранить изменения" : "Создать запись"}
              </>
            )}
          </Button>
        </div>
      </form>
    </Form>
  );
}