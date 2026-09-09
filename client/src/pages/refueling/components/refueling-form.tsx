import {
  useState,
  useEffect,
  useMemo,
  forwardRef,
  useImperativeHandle,
  useRef,
  createRef,
} from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  PRODUCT_TYPE,
  BASE_TYPE,
  COUNTERPARTY_TYPE,
  EQUIPMENT_TYPE,
} from "@shared/constants";
import { format } from "date-fns";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useErrorModal } from "@/hooks/use-error-modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Plus, Loader2 } from "lucide-react";
import type {
  Supplier,
  Base,
  Customer,
  Warehouse,
  Price,
} from "@shared/schema";
import { refuelingFormSchema, type RefuelingFormData } from "../schemas";
import { getReadableZodError } from "@/lib/form-errors";
import type { RefuelingFormProps } from "../types";
import { RefuelingMainFields } from "./refueling-main-fields";
import { RefuelingPricingSection } from "./refueling-pricing-section";
import { VolumeInputSection } from "./refueling-form-sections";
import { useRefuelingCalculations } from "../hooks/use-refueling-calculations";
import { useRefuelingFilters } from "../hooks/use-refueling-filters";
import { useAutoPriceSelection } from "../../shared/hooks/use-auto-price-selection";
import { extractPriceIdsForSubmit } from "../../shared/utils/price-utils";
import { useDuplicateCheck } from "../../shared/hooks/use-duplicate-check";
import { DuplicateAlertDialog } from "../../shared/components/duplicate-alert-dialog";
import { SpecialConditionsBanner } from "@/components/special-conditions-banner";
import {
  AdditionalProductSection,
  type AdditionalProductSectionHandle,
} from "./additional-product-section";
import { PRODUCT_TYPES } from "../constants";

export interface RefuelingFormHandle {
  getFormState: () => { supplierId: string; buyerId: string };
  saveAsDraft: () => Promise<void>;
  isDirty: () => boolean;
}

export const RefuelingForm = forwardRef<
  RefuelingFormHandle,
  RefuelingFormProps
>(({ onSuccess, editData, equipmentType = EQUIPMENT_TYPE.COMMON }, ref) => {
  const { toast } = useToast();
  const { showError, ErrorModalComponent } = useErrorModal();
  const [inputMode, setInputMode] = useState<"liters" | "kg">("liters");
  const [selectedBasis, setSelectedBasis] = useState<string>("");
  const [customerBasis, setCustomerBasis] = useState<string>("");
  const [selectedPurchasePriceId, setSelectedPurchasePriceId] =
    useState<string>("");
  const [selectedSalePriceId, setSelectedSalePriceId] = useState<string>("");
  const [initialQuantityKg, setInitialQuantityKg] = useState<number>(0);
  const [initialWarehouseBalance, setInitialWarehouseBalance] =
    useState<number>(0); // State for initial balance
  const [isDataInitialized, setIsDataInitialized] = useState(false);

  // Новые состояния для ЛИК
  const [selectedEquipmentId, setSelectedEquipmentId] = useState<string>(
    editData?.equipmentId || "",
  );
  const [equipmentBalance, setEquipmentBalance] = useState<number>(0);
  const isEditing = !!editData && !!editData.id;

  // Состояния включения агентского и прочих услуг в экономику сделки
  const [isAgentFeeEnabled, setIsAgentFeeEnabled] = useState<boolean>(
    editData?.isAgentFeeEnabled !== false
  );
  const [isOtherServiceEnabled, setIsOtherServiceEnabled] = useState<boolean>(
    editData?.isOtherServiceEnabled !== false
  );

  // Дополнительные продукты (многопродуктовое создание)
  const [additionalProducts, setAdditionalProducts] = useState<
    Array<{ id: string; productType: string }>
  >([]);
  const additionalProductRefs = useRef<
    Map<string, React.RefObject<AdditionalProductSectionHandle>>
  >(new Map());
  const [addProductPopoverOpen, setAddProductPopoverOpen] = useState(false);

  const initialValuesRef = useRef<RefuelingFormData | null>(null);

  const form = useForm<RefuelingFormData>({
    resolver: zodResolver(refuelingFormSchema),
    defaultValues: {
      refuelingDate: editData ? new Date(editData.refuelingDate) : new Date(),
      productType: editData?.productType || PRODUCT_TYPE.KEROSENE,
      aircraftNumber: editData?.aircraftNumber || "",
      orderNumber: editData?.orderNumber || "",
      supplierId: "",
      buyerId: "",
      warehouseId: "",
      inputMode: (editData?.inputMode as "liters" | "kg") || "liters",
      quantityLiters: editData?.quantityLiters?.toString() || "",
      density: editData?.density?.toString() || "",
      quantityKg: editData?.quantityKg?.toString() || "",
      notes: editData?.notes || "",
      isApproxVolume: editData?.isApproxVolume || false,
      isPlannedDeal: editData?.isPlannedDeal || false,
      isPriceRecharge: editData?.isPriceRecharge || false,
      isPvkjRecharge: editData?.isPvkjRecharge || false,
      setSalePriceZero: editData?.setSalePriceZero || false,
      isDraft: editData?.isDraft || false,
      selectedPurchasePriceId: "",
      selectedSalePriceId: "",
      basis: editData?.basis || "",
      customerBasis: editData?.customerBasis || "",
    },
  });

  useImperativeHandle(ref, () => ({
    getFormState: () => ({
      supplierId: form.getValues("supplierId") || "",
      buyerId: form.getValues("buyerId") || "",
    }),
    saveAsDraft: async () => {
      const values = form.getValues();
      if (editData?.id) {
        await updateMutation.mutateAsync({ ...values, isDraft: true, id: editData.id });
      } else {
        // Build common payload
        const { purchasePriceId, purchasePriceIndex, salePriceId, salePriceIndex } =
          extractPriceIdsForSubmit(
            selectedPurchasePriceId,
            selectedSalePriceId,
            purchasePrices,
            salePrices,
            isWarehouseSupplier,
          );
        const commonPayload = buildCommonPayload(values, true);
        const mainPayload = {
          ...commonPayload,
          productType: values.productType,
          purchasePrice: purchasePrice !== null ? purchasePrice : null,
          purchasePriceId: purchasePriceId || null,
          purchasePriceIndex: purchasePriceIndex !== undefined ? purchasePriceIndex : null,
          salePrice: salePrice !== null ? salePrice : null,
          salePriceId: salePriceId || null,
          salePriceIndex: salePriceIndex !== undefined ? salePriceIndex : null,
          purchaseAmount: purchaseAmount !== null ? purchaseAmount : null,
          saleAmount: saleAmount !== null ? saleAmount : null,
          agentFee: agentFee !== null ? agentFee : null,
          agentFeeRate: agentFeeRate || null,
          isAgentFeeEnabled,
          otherServiceFee: otherServiceFee || null,
          otherServiceName: otherServiceName || null,
          otherServiceType: otherServiceType || null,
          otherServiceQuantity: otherServiceQuantity ? parseFloat(otherServiceQuantity) : null,
          isOtherServiceEnabled,
          profit: profit !== null ? profit : null,
          isPriceRecharge: values.isPriceRecharge || false,
          isPvkjRecharge: values.isPvkjRecharge || false,
          setSalePriceZero: values.setSalePriceZero || false,
        };

        // Collect additional product payloads
        const additionalPayloads = additionalProducts
          .map((ap) => {
            const ref = additionalProductRefs.current.get(ap.id);
            const apPayload = ref?.current?.getPayload();
            if (!apPayload) return null;
            return { ...commonPayload, ...apPayload };
          })
          .filter(Boolean);

        await Promise.all(
          [mainPayload, ...additionalPayloads].map((p) =>
            apiRequest("POST", "/api/refueling", p).then((r) => r.json()),
          ),
        );

        // Invalidate and cleanup
        queryClient.invalidateQueries({ predicate: (q) => {
          const k = q.queryKey[0] as string;
          return k?.startsWith("/api/refueling") || k?.startsWith("/api/warehouses");
        }});
      }
    },
    isDirty: () => {
      if (!initialValuesRef.current) return form.formState.isDirty;
      const currentValues = form.getValues();
      return (
        JSON.stringify(currentValues) !==
        JSON.stringify(initialValuesRef.current)
      );
    },
  }));

  const { data: suppliers } = useQuery<Supplier[]>({
    queryKey: ["/api/suppliers"],
  });

  const { data: allBases } = useQuery<Base[]>({
    queryKey: ["/api/bases"],
  });

  const { data: warehouses } = useQuery<Warehouse[]>({
    // For LIK equipment type use the access-filtered endpoint
    queryKey: equipmentType === EQUIPMENT_TYPE.LIK ? ["/api/warehouses/lik"] : ["/api/warehouses"],
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
  const watchIsPriceRecharge = form.watch("isPriceRecharge");
  const watchIsPvkjRecharge = form.watch("isPvkjRecharge");

  const selectedSupplier = suppliers?.find((s) => s.id === watchSupplierId);
  const selectedBuyer = customers?.find((c) => c.id === watchBuyerId);
  const isWarehouseSupplier = selectedSupplier?.isWarehouse || false;
  const supplierWarehouse = warehouses?.find(
    (w) => w.supplierId === watchSupplierId,
  );

  const watchBasisId = form.watch("basisId");
  const watchCustomerBasisId = form.watch("customerBasisId");

  // Use filtering hook
  const { refuelingSuppliers, availableBases, purchasePrices, salePrices } =
    useRefuelingFilters({
      supplierId: watchSupplierId,
      buyerId: watchBuyerId,
      refuelingDate: watchRefuelingDate,
      basisId: watchBasisId || undefined,
      customerBasisId: watchCustomerBasisId || undefined,
      productType: watchProductType,
      baseType: BASE_TYPE.REFUELING,
      counterpartyType: COUNTERPARTY_TYPE.REFUELING,
      suppliers: suppliers ?? [],
      allBases: allBases ?? [],
      equipmentType,
      warehouses,
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
    agentFeeRate,
    otherServiceFee,
    hasOtherService,
    otherServiceName,
    otherServiceType,
    otherServiceQuantity,
    profit,
    warehouseStatus,
    contractVolumeStatus,
    supplierContractVolumeStatus,
  } = useRefuelingCalculations({
    inputMode,
    quantityLiters: watchLiters || "",
    density: watchDensity || "0.8",
    quantityKg: watchKg || "",
    isWarehouseSupplier,
    supplierWarehouse,
    selectedBasis,
    selectedBasisId: watchBasisId || undefined,
    purchasePrices,
    salePrices,
    selectedPurchasePriceId,
    selectedSalePriceId,
    selectedSupplier,
    productType: watchProductType,
    isEditing,
    initialQuantityKg,
    initialWarehouseBalance,
    refuelingDate: watchRefuelingDate,
    isPriceRecharge: watchIsPriceRecharge,
    isPvkjRecharge: watchIsPvkjRecharge,
    setSalePriceZero: form.watch("setSalePriceZero"),
    equipmentType,
    selectedEquipmentId,
    equipmentBalance,
    isAgentFeeEnabled,
    isOtherServiceEnabled,
  });

  const {
    showDuplicateDialog,
    setShowDuplicateDialog,
    checkDuplicate,
    handleConfirm,
    handleCancel,
    isChecking,
  } = useDuplicateCheck({
    type: "refueling",
    getFields: () => ({
      date: watchRefuelingDate,
      supplierId: watchSupplierId,
      buyerId: watchBuyerId,
      productType: watchProductType,
      basisId: watchBasisId,
      customerBasisId: watchCustomerBasisId,
      quantityKg: calculatedKg ? parseFloat(calculatedKg) : 0,
    }),
  });

  useEffect(() => {
    if (
      equipmentType === EQUIPMENT_TYPE.LIK &&
      refuelingSuppliers.length > 0 &&
      !watchSupplierId &&
      !editData
    ) {
      const firstSupplier = refuelingSuppliers[0];
      form.setValue("supplierId", firstSupplier.id);
    }
  }, [equipmentType, refuelingSuppliers, watchSupplierId, editData, form]);

  useEffect(() => {
    if (watchSupplierId && suppliers && allBases) {
      const supplier = suppliers.find((s) => s.id === watchSupplierId);

      if (supplier?.isWarehouse) {
        const warehouse = warehouses?.find((w) => w.supplierId === supplier.id);
        if (warehouse) {
          form.setValue("warehouseId", warehouse.id, { shouldDirty: true });
        }
      } else {
        form.setValue("warehouseId", "", { shouldDirty: true });
      }

      // Автоматически выбираем первый базис при выборе поставщика только для новых сделок
      if (supplier?.baseIds && supplier.baseIds.length >= 1 && !editData) {
        const refuelingBases = allBases.filter(
          (b) =>
            supplier.baseIds?.includes(b.id) &&
            b.baseType === BASE_TYPE.REFUELING,
        );
        if (refuelingBases.length > 0) {
          const firstBase = refuelingBases[0];
          form.setValue("basisId", firstBase.id, { shouldDirty: true });
          form.setValue("basis", firstBase.name, { shouldDirty: true });
          setSelectedBasis(firstBase.name);
        }
      }
    }
  }, [watchSupplierId, suppliers, allBases, warehouses, form, editData]);

  useEffect(() => {
    if (watchBuyerId && watchBasisId && selectedBasis) {
      // Автоматически устанавливаем покупателю базис поставщика
      form.setValue("customerBasisId", watchBasisId);
      form.setValue("customerBasis", selectedBasis);
      setCustomerBasis(selectedBasis);
    }
  }, [watchBuyerId, watchBasisId, selectedBasis]);

  // Используем общий хук для автоматического выбора цен
  useAutoPriceSelection({
    supplierId: watchSupplierId,
    buyerId: watchBuyerId,
    purchasePrices,
    salePrices,
    isWarehouseSupplier,
    editData,
    setSelectedPurchasePriceId,
    setSelectedSalePriceId,
    formSetValue: form.setValue as any,
  });

  useEffect(() => {
    if (
      editData &&
      suppliers &&
      customers &&
      allBases &&
      warehouses &&
      !isDataInitialized
    ) {
      // Added warehouses dependency
      const supplier = suppliers.find(
        (s) => s.name === editData.supplierId || s.id === editData.supplierId,
      );
      const buyer = customers.find(
        (c) => c.name === editData.buyerId || c.id === editData.buyerId,
      );

      // Construct composite price IDs with indices
      const purchasePriceCompositeId =
        editData.purchasePriceId && editData.purchasePriceIndex !== undefined
          ? `${editData.purchasePriceId}-${editData.purchasePriceIndex}`
          : editData.purchasePriceId || "";

      const salePriceCompositeId =
        editData.salePriceId && editData.salePriceIndex !== undefined
          ? `${editData.salePriceId}-${editData.salePriceIndex}`
          : editData.salePriceId || "";

      // Сохраняем изначальный остаток на складе (с учетом текущей сделки)
      if (editData.warehouseId) {
        const warehouse = warehouses.find((w) => w.id === editData.warehouseId);
        if (warehouse) {
          // Determine the correct balance based on product type
          const currentBalance =
            watchProductType === PRODUCT_TYPE.PVKJ
              ? parseFloat(warehouse.pvkjBalance || "0")
              : parseFloat(warehouse.currentBalance || "0");
          const dealQuantity = parseFloat(editData.quantityKg || "0"); // Assuming quantityKg is the relevant quantity for balance adjustment
          setInitialWarehouseBalance(currentBalance + dealQuantity);
        }
      }

      const basisBase = allBases.find((b) => b.id === editData.basisId);
      const resolvedBasisName = basisBase?.name || editData.basis || "";
      const customerBasisBase = allBases.find((b) => b.id === editData.customerBasisId);
      const resolvedCustomerBasisName = customerBasisBase?.name || editData.customerBasis || "";

      const resetValues = {
        refuelingDate: new Date(editData.refuelingDate),
        productType: editData.productType,
        aircraftNumber: editData.aircraftNumber || "",
        orderNumber: editData.orderNumber || "",
        flightNumber: editData.flightNumber || "",
        supplierId: supplier?.id || "",
        buyerId: buyer?.id || "",
        warehouseId: editData.warehouseId || "",
        inputMode: (editData.quantityLiters ? "liters" : "kg") as
          | "liters"
          | "kg",
        quantityLiters: editData.quantityLiters?.toString() || "",
        density: editData.density?.toString() || "",
        quantityKg: editData.quantityKg?.toString() || "",
        notes: editData.notes || "",
        isApproxVolume: editData.isApproxVolume || false,
        isPlannedDeal: editData.isPlannedDeal || false,
        isPriceRecharge: editData.isPriceRecharge || false,
        isPvkjRecharge: editData.isPvkjRecharge || false,
        setSalePriceZero: editData.setSalePriceZero || false,
        selectedPurchasePriceId: purchasePriceCompositeId,
        selectedSalePriceId: salePriceCompositeId,
        basis: resolvedBasisName,
        basisId: editData.basisId || "",
        customerBasis: resolvedCustomerBasisName,
        customerBasisId: editData.customerBasisId || "",
        isDraft: editData.isDraft || false,
      };

      initialValuesRef.current = resetValues;
      form.reset(resetValues, { keepDefaultValues: false });

      setSelectedPurchasePriceId(purchasePriceCompositeId);
      setSelectedSalePriceId(salePriceCompositeId);
      setInitialQuantityKg(
        isEditing && !editData.isDraft
          ? parseFloat(editData.quantityKg || "0")
          : 0,
      );

      setCustomerBasis(resolvedCustomerBasisName);
      setSelectedBasis(resolvedBasisName);

      if (editData.quantityLiters && !editData.inputMode) {
        setInputMode("liters");
      } else if (editData.inputMode) {
        setInputMode(editData.inputMode as "liters" | "kg");
      } else {
        setInputMode("liters");
      }

      // Инициализируем флаги включения услуг из данных сделки
      setIsAgentFeeEnabled(editData.isAgentFeeEnabled !== false);
      setIsOtherServiceEnabled(editData.isOtherServiceEnabled !== false);

      setIsDataInitialized(true);
    }
  }, [
    editData,
    suppliers,
    customers,
    allBases,
    warehouses,
    form,
    watchProductType,
    isDataInitialized,
    isEditing,
  ]); // Added watchProductType dependency

  const createMutation = useMutation({
    mutationFn: async (data: RefuelingFormData) => {
      const {
        purchasePriceId,
        purchasePriceIndex,
        salePriceId,
        salePriceIndex,
      } = extractPriceIdsForSubmit(
        selectedPurchasePriceId,
        selectedSalePriceId,
        purchasePrices,
        salePrices,
        isWarehouseSupplier,
      );

      const payload = {
        ...data,
        supplierId: data.supplierId || null,
        buyerId: data.buyerId || null,
        isDraft: data.isDraft || false,
        isPriceRecharge: data.isPriceRecharge || false,
        inputMode: data.inputMode || inputMode,
        warehouseId:
          isWarehouseSupplier && supplierWarehouse
            ? supplierWarehouse.id
            : null,
        basis: selectedBasis || null, // Use selectedBasis
        basisId: data.basisId || null,
        customerBasis: customerBasis || null,
        customerBasisId: data.customerBasisId || null,
        refuelingDate: data.refuelingDate
          ? format(data.refuelingDate, "yyyy-MM-dd'T'HH:mm:ss")
          : null,
        quantityKg: calculatedKg ? parseFloat(calculatedKg) : null,
        quantityLiters: data.quantityLiters
          ? parseFloat(data.quantityLiters)
          : null,
        density: data.density ? parseFloat(data.density) : null,
        purchasePrice: purchasePrice !== null ? purchasePrice : null,
        purchasePriceId: purchasePriceId || null,
        purchasePriceIndex:
          purchasePriceIndex !== undefined ? purchasePriceIndex : null,
        salePrice: salePrice !== null ? salePrice : null,
        salePriceId: salePriceId || null,
        salePriceIndex: salePriceIndex !== undefined ? salePriceIndex : null,
        purchaseAmount: purchaseAmount !== null ? purchaseAmount : null,
        saleAmount: saleAmount !== null ? saleAmount : null,
        agentFee: agentFee !== null ? agentFee : null,
        agentFeeRate: agentFeeRate || null,
        isAgentFeeEnabled: isAgentFeeEnabled,
        otherServiceFee: otherServiceFee || null,
        otherServiceName: otherServiceName || null,
        otherServiceType: otherServiceType || null,
        otherServiceQuantity: otherServiceQuantity ? parseFloat(otherServiceQuantity) : null,
        isOtherServiceEnabled: isOtherServiceEnabled,
        profit: profit !== null ? profit : null,
        equipmentType: equipmentType,
        equipmentId:
          equipmentType === EQUIPMENT_TYPE.LIK ? selectedEquipmentId || null : null,
      };
      const res = await apiRequest("POST", "/api/refueling", payload);
      return res.json();
    },
    onSuccess: (data) => {
      if (data?.id && !data?.isDraft) {
        const lsKey = equipmentType === EQUIPMENT_TYPE.LIK ? "lastCreatedDeal_lik" : "lastCreatedDeal_refueling";
        localStorage.setItem(lsKey, JSON.stringify({ id: data.id, timestamp: Date.now() }));
        window.dispatchEvent(new CustomEvent("dealCreated", { detail: { type: equipmentType === EQUIPMENT_TYPE.LIK ? "lik" : "refueling", id: data.id } }));
      }
      queryClient.invalidateQueries({
        queryKey: ["/api/refueling/contract-used"],
      });
      if (equipmentType === EQUIPMENT_TYPE.LIK) {
        queryClient.invalidateQueries({
          queryKey: ["/api/warehouses/equipment-map"],
        });
      }
      queryClient.invalidateQueries({
        predicate: (query) => {
          const key = query.queryKey[0] as string;
          return (
            key?.startsWith("/api/refueling") ||
            key?.startsWith("/api/warehouses")
          );
        },
      });
      toast({
        title: "Заправка создана",
        description: "Заправка ВС успешно сохранена",
      });
      form.reset();
      setSelectedPurchasePriceId("");
      setSelectedSalePriceId("");
      setSelectedBasis("");
      setCustomerBasis("");
      onSuccess?.();
    },
    onError: (error: Error) => {
      showError(error, "refueling");
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: RefuelingFormData & { id: string }) => {
      const {
        purchasePriceId,
        purchasePriceIndex,
        salePriceId,
        salePriceIndex,
      } = extractPriceIdsForSubmit(
        selectedPurchasePriceId,
        selectedSalePriceId,
        purchasePrices,
        salePrices,
        isWarehouseSupplier,
      );

      const payload = {
        ...data,
        supplierId: data.supplierId || null,
        buyerId: data.buyerId || null,
        isDraft: data.isDraft || false,
        isPriceRecharge: data.isPriceRecharge || false,
        inputMode: data.inputMode || inputMode,
        warehouseId:
          isWarehouseSupplier && supplierWarehouse
            ? supplierWarehouse.id
            : null,
        basis: selectedBasis || null, // Use selectedBasis
        basisId: data.basisId || null,
        customerBasis: customerBasis || null,
        customerBasisId: data.customerBasisId || null,
        refuelingDate: data.refuelingDate
          ? format(data.refuelingDate, "yyyy-MM-dd'T'HH:mm:ss")
          : null,
        quantityKg: calculatedKg ? parseFloat(calculatedKg) : null,
        quantityLiters: data.quantityLiters
          ? parseFloat(data.quantityLiters)
          : null,
        density: data.density ? parseFloat(data.density) : null,
        purchasePrice: purchasePrice !== null ? purchasePrice : null,
        purchasePriceId: purchasePriceId || null,
        purchasePriceIndex:
          purchasePriceIndex !== undefined ? purchasePriceIndex : null,
        salePrice: salePrice !== null ? salePrice : null,
        salePriceId: salePriceId || null,
        salePriceIndex: salePriceIndex !== undefined ? salePriceIndex : null,
        purchaseAmount: purchaseAmount !== null ? purchaseAmount : null,
        saleAmount: saleAmount !== null ? saleAmount : null,
        agentFee: agentFee !== null ? agentFee : null,
        agentFeeRate: agentFeeRate || null,
        isAgentFeeEnabled: isAgentFeeEnabled,
        otherServiceFee: otherServiceFee || null,
        otherServiceName: otherServiceName || null,
        otherServiceType: otherServiceType || null,
        otherServiceQuantity: otherServiceQuantity ? parseFloat(otherServiceQuantity) : null,
        isOtherServiceEnabled: isOtherServiceEnabled,
        profit: profit !== null ? profit : null,
        equipmentType: equipmentType,
        equipmentId:
          equipmentType === EQUIPMENT_TYPE.LIK ? selectedEquipmentId || null : null,
      };
      const res = await apiRequest(
        "PATCH",
        `/api/refueling/${data.id}`,
        payload,
      );
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["/api/refueling/contract-used"],
      });
      if (equipmentType === EQUIPMENT_TYPE.LIK) {
        queryClient.invalidateQueries({
          queryKey: ["/api/warehouses/equipment-map"],
        });
      }
      queryClient.invalidateQueries({
        predicate: (query) => {
          const key = query.queryKey[0] as string;
          return (
            key?.startsWith("/api/refueling") ||
            key?.startsWith("/api/warehouses")
          );
        },
      });
      toast({
        title: "Заправка обновлена",
        description: "Заправка ВС успешно обновлена",
      });
      form.reset();
      setSelectedPurchasePriceId("");
      setSelectedSalePriceId("");
      setSelectedBasis("");
      setCustomerBasis("");
      onSuccess?.();
    },
    onError: (error: Error) => {
      showError(error, "refueling");
    },
  });

  // Helper: builds the common (shared) payload fields from form data
  const buildCommonPayload = (data: RefuelingFormData, isDraft: boolean) => ({
    supplierId: data.supplierId || null,
    buyerId: data.buyerId || null,
    isDraft,
    inputMode: data.inputMode || inputMode,
    warehouseId:
      isWarehouseSupplier && supplierWarehouse ? supplierWarehouse.id : null,
    basis: selectedBasis || null,
    basisId: data.basisId || null,
    customerBasis: customerBasis || null,
    customerBasisId: data.customerBasisId || null,
    refuelingDate: data.refuelingDate
      ? format(data.refuelingDate, "yyyy-MM-dd'T'HH:mm:ss")
      : null,
    quantityKg: calculatedKg ? parseFloat(calculatedKg) : null,
    quantityLiters: data.quantityLiters ? parseFloat(data.quantityLiters) : null,
    density: data.density ? parseFloat(data.density) : null,
    aircraftNumber: data.aircraftNumber || null,
    orderNumber: data.orderNumber || null,
    flightNumber: data.flightNumber || null,
    notes: data.notes || null,
    isApproxVolume: data.isApproxVolume || false,
    isPlannedDeal: data.isPlannedDeal || false,
    equipmentType,
    equipmentId:
      equipmentType === EQUIPMENT_TYPE.LIK ? selectedEquipmentId || null : null,
  });

  // Mutation for creating multiple products in one go
  const createAllMutation = useMutation({
    mutationFn: async (payloads: object[]) => {
      const results = await Promise.all(
        payloads.map((p) => apiRequest("POST", "/api/refueling", p).then((r) => r.json())),
      );
      return results;
    },
    onSuccess: (results: any[]) => {
      results.forEach((data) => {
        if (data?.id && !data?.isDraft) {
          const lsKey =
            equipmentType === EQUIPMENT_TYPE.LIK
              ? "lastCreatedDeal_lik"
              : "lastCreatedDeal_refueling";
          localStorage.setItem(
            lsKey,
            JSON.stringify({ id: data.id, timestamp: Date.now() }),
          );
          window.dispatchEvent(
            new CustomEvent("dealCreated", {
              detail: {
                type: equipmentType === EQUIPMENT_TYPE.LIK ? "lik" : "refueling",
                id: data.id,
              },
            }),
          );
        }
      });
      queryClient.invalidateQueries({
        queryKey: ["/api/refueling/contract-used"],
      });
      if (equipmentType === EQUIPMENT_TYPE.LIK) {
        queryClient.invalidateQueries({
          queryKey: ["/api/warehouses/equipment-map"],
        });
      }
      queryClient.invalidateQueries({
        predicate: (query) => {
          const key = query.queryKey[0] as string;
          return (
            key?.startsWith("/api/refueling") ||
            key?.startsWith("/api/warehouses")
          );
        },
      });
      const isDraft = results.some((r) => r?.isDraft);
      const count = results.length;
      const pluralSuffix =
        count === 1 ? "а" : count < 5 ? "и" : "";
      toast({
        title: isDraft ? "Черновики сохранены" : "Сделки созданы",
        description: isDraft
          ? `Сохранено ${count} черновик${count === 1 ? "" : count < 5 ? "а" : "ов"}`
          : `Создано ${count} заправк${count === 1 ? "а" : pluralSuffix}`,
      });
      form.reset();
      setSelectedPurchasePriceId("");
      setSelectedSalePriceId("");
      setSelectedBasis("");
      setCustomerBasis("");
      setAdditionalProducts([]);
      onSuccess?.();
    },
    onError: (error: Error) => {
      showError(error, "refueling");
    },
  });

  useEffect(() => {
    if (watchProductType !== PRODUCT_TYPE.SERVICE) {
      form.setValue("isPriceRecharge", false);
    }
    if (watchProductType !== PRODUCT_TYPE.PVKJ) {
      form.setValue("isPvkjRecharge", false);
    }
  }, [watchProductType, form]);

  // Когда "Перевыставить" активно — принудительно снимаем чекбоксы услуг
  // При деактивации не трогаем — пользователь сам управляет чекбоксами
  useEffect(() => {
    const isRechargeActive = watchIsPriceRecharge || watchIsPvkjRecharge;
    if (isRechargeActive) {
      setIsAgentFeeEnabled(false);
      setIsOtherServiceEnabled(false);
    }
  }, [watchIsPriceRecharge, watchIsPvkjRecharge]);

  useEffect(() => {
    if (inputMode === "liters" && calculatedKg && parseFloat(calculatedKg) > 0) {
      form.setValue("quantityKg", calculatedKg, { shouldDirty: false, shouldValidate: false });
    }
  }, [calculatedKg, inputMode, form]);

  // Compute available product types for the "Add Product" button
  const usedProductTypes = useMemo(() => {
    const used = new Set<string>();
    used.add(watchProductType);
    additionalProducts.forEach((p) => used.add(p.productType));
    return used;
  }, [watchProductType, additionalProducts]);

  const availableProductsToAdd = useMemo(
    () => PRODUCT_TYPES.filter((p) => !usedProductTypes.has(p.value)),
    [usedProductTypes],
  );

  const handleAddProduct = (productType: string) => {
    const id = `${productType}-${Date.now()}`;
    const newRef = createRef<AdditionalProductSectionHandle>();
    additionalProductRefs.current.set(id, newRef);
    setAdditionalProducts((prev) => [...prev, { id, productType }]);
    setAddProductPopoverOpen(false);
  };

  const handleRemoveAdditionalProduct = (id: string) => {
    additionalProductRefs.current.delete(id);
    setAdditionalProducts((prev) => prev.filter((p) => p.id !== id));
  };

  const onSubmit = async (data: RefuelingFormData, isDraftSubmit?: boolean) => {
    const productType = watchProductType;
    const isDraft = isDraftSubmit ?? data.isDraft;

    // Если не черновик, выполняем полную валидацию основного продукта
    if (!isDraft) {
      if (!calculatedKg || parseFloat(calculatedKg) <= 0) {
        showError("Укажите корректное количество топлива.");
        return;
      }
      if (
        !isWarehouseSupplier &&
        productType !== PRODUCT_TYPE.SERVICE &&
        purchasePrice === null
      ) {
        showError("Не указана цена покупки. Выберите цену или проверьте настройки поставщика.");
        return;
      }
      if (salePrice === null) {
        showError("Не указана цена продажи. Выберите цену или проверьте настройки покупателя.");
        return;
      }
      if (warehouseStatus.status === "error") {
        showError(warehouseStatus.message);
        return;
      }
      if (contractVolumeStatus.status === "error") {
        showError(contractVolumeStatus.message);
        return;
      }
      if (!isWarehouseSupplier && supplierContractVolumeStatus.status === "error") {
        showError(supplierContractVolumeStatus.message);
        return;
      }
    } else {
      if (!data.supplierId || !data.buyerId) {
        showError("Для сохранения черновика необходимо выбрать поставщика и покупателя.");
        return;
      }
    }

    // Editing mode — single record, no additional products
    if (editData && editData.id) {
      updateMutation.mutate({ ...data, isDraft, id: editData.id });
      return;
    }

    // Validate additional products
    if (additionalProducts.length > 0 && !isDraft) {
      for (const ap of additionalProducts) {
        const apRef = additionalProductRefs.current.get(ap.id);
        const err = apRef?.current?.validate(isDraft);
        if (err) {
          showError(err);
          return;
        }
      }
    }

    // Build the common (shared) payload
    const commonPayload = buildCommonPayload(data, isDraft);

    // Build main product payload
    const {
      purchasePriceId,
      purchasePriceIndex,
      salePriceId,
      salePriceIndex,
    } = extractPriceIdsForSubmit(
      selectedPurchasePriceId,
      selectedSalePriceId,
      purchasePrices,
      salePrices,
      isWarehouseSupplier,
    );
    const mainPayload = {
      ...commonPayload,
      productType,
      isPriceRecharge: data.isPriceRecharge || false,
      isPvkjRecharge: data.isPvkjRecharge || false,
      setSalePriceZero: data.setSalePriceZero || false,
      purchasePrice: purchasePrice !== null ? purchasePrice : null,
      purchasePriceId: purchasePriceId || null,
      purchasePriceIndex: purchasePriceIndex !== undefined ? purchasePriceIndex : null,
      salePrice: salePrice !== null ? salePrice : null,
      salePriceId: salePriceId || null,
      salePriceIndex: salePriceIndex !== undefined ? salePriceIndex : null,
      purchaseAmount: purchaseAmount !== null ? purchaseAmount : null,
      saleAmount: saleAmount !== null ? saleAmount : null,
      agentFee: agentFee !== null ? agentFee : null,
      agentFeeRate: agentFeeRate || null,
      isAgentFeeEnabled,
      otherServiceFee: otherServiceFee || null,
      otherServiceName: otherServiceName || null,
      otherServiceType: otherServiceType || null,
      otherServiceQuantity: otherServiceQuantity ? parseFloat(otherServiceQuantity) : null,
      isOtherServiceEnabled,
      profit: profit !== null ? profit : null,
    };

    // Collect additional product payloads
    const additionalPayloads = additionalProducts
      .map((ap) => {
        const apRef = additionalProductRefs.current.get(ap.id);
        const apPayload = apRef?.current?.getPayload();
        if (!apPayload) return null;
        return { ...commonPayload, ...apPayload };
      })
      .filter(Boolean) as object[];

    const allPayloads = [mainPayload, ...additionalPayloads];

    // For single product creation — use existing flow with duplicate check
    if (additionalPayloads.length === 0) {
      const isNewDeal = !isEditing;
      const isPublishingDraft = editData?.isDraft && !isDraft;
      if (isNewDeal || isPublishingDraft || editData?.id !== undefined) {
        checkDuplicate(() => createMutation.mutate({ ...data, isDraft }));
        return;
      }
      createMutation.mutate({ ...data, isDraft });
      return;
    }

    // Multiple products — use createAllMutation (duplicate check only on main product)
    const isNewDeal = !isEditing;
    const isPublishingDraft = editData?.isDraft && !isDraft;
    if (isNewDeal || isPublishingDraft) {
      checkDuplicate(() => createAllMutation.mutate(allPayloads));
      return;
    }
    createAllMutation.mutate(allPayloads);
  };

  return (
    <>
      <Form {...form}>
        <form
          onSubmit={(e) => e.preventDefault()}
          className="space-y-6"
        >
          <RefuelingMainFields
            form={form}
            refuelingSuppliers={refuelingSuppliers}
            customers={customers}
            selectedSupplier={selectedSupplier}
            selectedBuyer={selectedBuyer}
            selectedBasis={selectedBasis}
            setSelectedBasis={setSelectedBasis}
            customerBasis={customerBasis}
            setCustomerBasis={setCustomerBasis}
            availableBases={availableBases}
            allBases={allBases}
            equipmentType={equipmentType}
            selectedEquipmentId={selectedEquipmentId}
            setSelectedEquipmentId={setSelectedEquipmentId}
            equipmentBalance={equipmentBalance}
            setEquipmentBalance={setEquipmentBalance}
            supplierWarehouse={supplierWarehouse}
            warehouses={warehouses}
          />

          <VolumeInputSection
            form={form}
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
            agentFeeRate={agentFeeRate}
            otherServiceFee={otherServiceFee}
            hasOtherService={hasOtherService}
            otherServiceName={otherServiceName}
            otherServiceType={otherServiceType}
            otherServiceQuantity={otherServiceQuantity}
            warehouseStatus={warehouseStatus}
            contractVolumeStatus={contractVolumeStatus}
            supplierContractVolumeStatus={supplierContractVolumeStatus}
            productType={watchProductType}
            selectedSupplier={selectedSupplier}
            equipmentType={equipmentType}
            isAgentFeeEnabled={isAgentFeeEnabled}
            isOtherServiceEnabled={isOtherServiceEnabled}
            onAgentFeeEnabledChange={setIsAgentFeeEnabled}
            onOtherServiceEnabledChange={setIsOtherServiceEnabled}
            isRechargeActive={!!(watchIsPriceRecharge || watchIsPvkjRecharge)}
          />

          <div className="grid gap-4 md:grid-cols-2 items-end">
            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Примечания</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Дополнительная информация..."
                      data-testid="input-notes"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex flex-col gap-2 pb-2">
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
              <FormField
                control={form.control}
                name="isPlannedDeal"
                render={({ field }) => (
                  <FormItem className="flex items-center gap-2 space-y-0">
                    <FormControl>
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        data-testid="checkbox-planned-deal"
                      />
                    </FormControl>
                    <FormLabel className="text-sm font-normal cursor-pointer">
                      Планируемая сделка
                    </FormLabel>
                  </FormItem>
                )}
              />
            </div>
          </div>

          {/* Additional product sections */}
          {additionalProducts.map((ap) => {
            let ref = additionalProductRefs.current.get(ap.id);
            if (!ref) {
              ref = createRef<AdditionalProductSectionHandle>();
              additionalProductRefs.current.set(ap.id, ref);
            }
            return (
              <AdditionalProductSection
                key={ap.id}
                ref={ref}
                productType={ap.productType}
                onRemove={() => handleRemoveAdditionalProduct(ap.id)}
                supplierId={watchSupplierId}
                buyerId={watchBuyerId}
                refuelingDate={watchRefuelingDate}
                basisId={watchBasisId || ""}
                customerBasisId={watchCustomerBasisId || ""}
                selectedBasis={selectedBasis}
                selectedBasisId={watchBasisId || ""}
                selectedSupplier={selectedSupplier}
                isWarehouseSupplier={isWarehouseSupplier}
                supplierWarehouse={supplierWarehouse}
                equipmentType={equipmentType}
                selectedEquipmentId={selectedEquipmentId}
                equipmentBalance={equipmentBalance}
                inputMode={inputMode}
                quantityLiters={watchLiters || ""}
                density={watchDensity || "0.8"}
                quantityKg={watchKg || ""}
                suppliers={suppliers ?? []}
                allBases={allBases ?? []}
                warehouses={warehouses}
              />
            );
          })}

          {/* "Add Product" button — only when not editing, not all 3 products selected */}
          {!isEditing && availableProductsToAdd.length > 0 && (
            <div className="flex items-center">
              <Popover open={addProductPopoverOpen} onOpenChange={setAddProductPopoverOpen}>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="gap-2"
                    data-testid="button-add-product"
                  >
                    <Plus className="h-4 w-4" />
                    Добавить продукт
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-52 p-2" align="start">
                  <div className="flex flex-col gap-1">
                    <p className="text-xs text-muted-foreground px-2 pb-1">
                      Выберите продукт
                    </p>
                    {availableProductsToAdd.map((pt) => (
                      <Button
                        key={pt.value}
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="justify-start"
                        onClick={() => handleAddProduct(pt.value)}
                      >
                        {pt.label}
                      </Button>
                    ))}
                  </div>
                </PopoverContent>
              </Popover>
            </div>
          )}

          <div className="space-y-2">
            <SpecialConditionsBanner counterparty={selectedSupplier} label={selectedSupplier?.name} />
            <SpecialConditionsBanner counterparty={selectedBuyer} label={selectedBuyer?.name} />
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

            {!isEditing || (editData && editData.isDraft) ? (
              <Button
                type="button"
                variant="secondary"
                disabled={
                  createMutation.isPending ||
                  createAllMutation.isPending ||
                  updateMutation.isPending ||
                  isChecking
                }
                onClick={() => {
                  form.clearErrors();
                  form.handleSubmit(
                    (data) => onSubmit(data, true),
                    (errors) => {
                      showError(getReadableZodError(errors, "Для сохранения черновика необходимо выбрать поставщика и покупателя."));
                    },
                  )();
                }}
              >
                {createMutation.isPending ||
                createAllMutation.isPending ||
                updateMutation.isPending ||
                isChecking ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : null}
                Сохранить черновик
              </Button>
            ) : null}

            <Button
              type="button"
              disabled={
                createMutation.isPending ||
                createAllMutation.isPending ||
                updateMutation.isPending ||
                isChecking
              }
              onClick={() => {
                form.handleSubmit(
                  (data) => onSubmit(data, false),
                  (errors) => {
                    showError(getReadableZodError(errors, "Заполните все обязательные поля перед созданием сделки."));
                  },
                )();
              }}
              data-testid="button-submit-refueling"
            >
              {createMutation.isPending ||
              createAllMutation.isPending ||
              updateMutation.isPending ||
              isChecking ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {isEditing ? "Сохранение..." : "Создание..."}
                </>
              ) : (
                <>
                  {isEditing && !editData.isDraft
                    ? "Сохранить изменения"
                    : additionalProducts.length > 0
                      ? `Создать сделки (${additionalProducts.length + 1})`
                      : "Создать сделку"}
                </>
              )}
            </Button>
          </div>
        </form>
      </Form>

      <DuplicateAlertDialog
        open={showDuplicateDialog}
        onOpenChange={setShowDuplicateDialog}
        onConfirm={handleConfirm}
        onCancel={handleCancel}
        description="В системе уже есть заправка с такими же параметрами (дата, поставщик, покупатель, базис и объем). Продолжить создание?"
      />
      <ErrorModalComponent />
    </>
  );
});
