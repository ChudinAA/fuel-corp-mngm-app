import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { format } from "date-fns";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useErrorModal } from "@/hooks/use-error-modal";
import { useMinimizableDialog } from "@/hooks/use-minimizable-dialog";
import { Button } from "@/components/ui/button";
import { createPortal } from "react-dom";
import {
  Dialog,
  MinimizableDialog,
  MinimizableDialogContent,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Form } from "@/components/ui/form";
import { Plus, Loader2, Minus, ChevronUp, X } from "lucide-react";
import type { Base, Supplier, Customer, Currency } from "@shared/schema";
import {
  COUNTERPARTY_ROLE,
  COUNTERPARTY_TYPE,
  PRODUCT_TYPE,
} from "@shared/constants";
import {
  formatTonnesForInput,
} from "@shared/units";
import { priceFormSchema } from "../schemas";
import type { PriceFormData, PriceDialogProps } from "../types";
import { useDateCheck } from "../hooks/use-date-check";
import { PriceFormFields } from "./price-form-fields";
import { PriceChecksPanel } from "./price-checks-panel";
import { getLatestPriceContract, isPriceContractRequired } from "@shared/price-contract-selection";

export function AddPriceDialog({
  editPrice,
  onEditComplete,
  isInline = false,
  inlineOpen = false,
  onInlineOpenChange,
  onCreated,
  inlineDefaults,
}: PriceDialogProps) {
  const { toast } = useToast();
  const { showError, ErrorModalComponent } = useErrorModal();
  const [localOpen, setLocalOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);

  const open = isInline ? inlineOpen : localOpen;
  const setOpen = isInline ? onInlineOpenChange || setLocalOpen : setLocalOpen;

  const [dateCheckPassed, setDateCheckPassed] = useState(false);

  const dateCheck = useDateCheck();

  const getDefaultDateTo = () => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d;
  };

  const form = useForm<PriceFormData>({
    resolver: zodResolver(priceFormSchema),
    defaultValues: {
      dateFrom: new Date(),
      dateTo: getDefaultDateTo(),
      counterpartyType: COUNTERPARTY_TYPE.WHOLESALE,
      counterpartyRole: COUNTERPARTY_ROLE.SUPPLIER,
      counterpartyId: "",
      productType: PRODUCT_TYPE.KEROSENE,
      nomenclatureId: "",
      contractId: "",
      basis: "",
      basisId: undefined,
      loadingBasisId: undefined,
      limitType: "volume" as "volume" | "amount",
      volume: "",
      maxDealAmount: "",
      priceValues: [{ price: "" }],
      contractNumber: "",
      contractAppendix: "",
      notes: "",
      priceUnit: "tonne" as "tonne" | "liter",
      contractLimitEnabled: true,
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "priceValues",
  });

  const prevEditPriceRef = useRef<typeof editPrice>(undefined);

  useEffect(() => {
    const prevEditPrice = prevEditPriceRef.current;
    prevEditPriceRef.current = editPrice;

    if (editPrice) {
      const editPriceUnit =
        editPrice.priceRate?.unit ??
        (editPrice.priceUnit === "liter" ? "liter" : "tonne");
      let parsedPriceValues = [{ price: "" }];
      if (editPrice.priceRate) {
        parsedPriceValues = editPrice.priceRate.values.map((price) => ({
          price: price === null ? "" : price.toFixed(2),
        }));
        if (parsedPriceValues.length === 0) {
          parsedPriceValues = [{ price: "" }];
        }
      }

      form.reset({
        dateFrom: new Date(editPrice.dateFrom),
        dateTo: new Date(editPrice.dateTo || editPrice.dateFrom),
        counterpartyType: editPrice.counterpartyType,
        counterpartyRole: editPrice.counterpartyRole,
        counterpartyId: editPrice.counterpartyId,
        productType: editPrice.productType,
        nomenclatureId: (editPrice as any).nomenclatureId || "",
        contractId: (editPrice as any).contractId || "",
        basis: editPrice.basis || "",
        basisId: editPrice.basisId || undefined,
        loadingBasisId: editPrice.loadingBasisId || undefined,
        currency: editPrice.currency || "RUB",
        currencyId: editPrice.currencyId || undefined,
        limitType: ((editPrice as any).limitType as "volume" | "amount") || "volume",
        volume:
          editPrice.contractVolume?.limit !== undefined
            ? editPrice.contractVolume.limit === null
              ? ""
              : formatTonnesForInput(editPrice.contractVolume.limit)
            : editPrice.volume
              ? formatTonnesForInput(Number(editPrice.volume))
              : "",
        maxDealAmount: (editPrice as any).maxDealAmount || "",
        priceValues: parsedPriceValues,
        contractNumber: editPrice.contractNumber || "",
        contractAppendix: (editPrice as any).contractAppendix || "",
        notes: editPrice.notes || "",
        priceUnit: editPriceUnit,
        contractLimitEnabled: (editPrice as any).contractLimitEnabled !== false,
      } as PriceFormData);
      setOpen(true);
      setDateCheckPassed(false);
    } else if (prevEditPrice && !editPrice) {
      // editPrice was cleared (edit completed/cancelled) — reset form to defaults
      form.reset({
        dateFrom: new Date(),
        dateTo: getDefaultDateTo(),
        counterpartyType: COUNTERPARTY_TYPE.WHOLESALE,
        counterpartyRole: COUNTERPARTY_ROLE.SUPPLIER,
        counterpartyId: "",
        productType: PRODUCT_TYPE.KEROSENE,
        nomenclatureId: "",
        contractId: "",
        basis: "",
        basisId: undefined,
        loadingBasisId: undefined,
        currency: "RUB",
        currencyId: undefined,
        limitType: "volume" as "volume" | "amount",
        volume: "",
        maxDealAmount: "",
        priceValues: [{ price: "" }],
        contractNumber: "",
        contractAppendix: "",
        notes: "",
        priceUnit: "tonne" as "tonne" | "liter",
        contractLimitEnabled: true,
      });
      dateCheck.setResult(null);
      setDateCheckPassed(false);
    }
  }, [editPrice]);

  // Сброс свернутого состояния при открытии
  useEffect(() => {
    if (isInline && inlineOpen) {
      setIsMinimized(false);
    }
  }, [isInline, inlineOpen]);

  // Применяем inlineDefaults когда inline-диалог открывается
  useEffect(() => {
    if (isInline && inlineOpen && !editPrice && inlineDefaults) {
      const defaults = {
        dateFrom: new Date(),
        dateTo: getDefaultDateTo(),
        counterpartyType: COUNTERPARTY_TYPE.WHOLESALE,
        counterpartyRole: COUNTERPARTY_ROLE.SUPPLIER,
        counterpartyId: "",
        productType: PRODUCT_TYPE.KEROSENE,
        basis: "",
        basisId: undefined,
        loadingBasisId: undefined,
        currency: "RUB",
        currencyId: undefined,
        limitType: "volume" as "volume" | "amount",
        volume: "",
        maxDealAmount: "",
        priceValues: [{ price: "" }],
        contractNumber: "",
        contractAppendix: "",
        notes: "",
        priceUnit: "tonne" as "tonne" | "liter",
        contractLimitEnabled: true,
        ...inlineDefaults,
      };
      form.reset(defaults as PriceFormData);
      setDateCheckPassed(false);
      dateCheck.setResult(null);
    }
  }, [isInline, inlineOpen]);

  const watchCounterpartyType = form.watch("counterpartyType");
  const watchCounterpartyRole = form.watch("counterpartyRole");
  const watchCounterpartyId = form.watch("counterpartyId");
  const watchDateFrom = form.watch("dateFrom");
  const watchDateTo = form.watch("dateTo");
  const watchBasis = form.watch("basis");
  const watchBasisId = form.watch("basisId");
  const watchLoadingBasisId = form.watch("loadingBasisId");
  const watchProductType = form.watch("productType");
  const watchNomenclatureId = form.watch("nomenclatureId");

  // Сбрасывать проверку дат при изменении критических полей
  useEffect(() => {
    setDateCheckPassed(false);
    dateCheck.setResult(null);
  }, [
    watchCounterpartyId,
    watchBasisId,
    watchBasis,
    watchLoadingBasisId,
    watchProductType,
    watchNomenclatureId,
    watchDateFrom,
    watchDateTo,
  ]);

  const { data: directoryContracts, isSuccess: contractsLoaded } = useQuery<any[]>({
    queryKey: ["/api/contracts"],
    enabled: open,
  });
  const prevCounterpartyKeyRef = useRef<string>("");
  useEffect(() => {
    if (!open) {
      prevCounterpartyKeyRef.current = "";
      return;
    }
    if (editPrice || !contractsLoaded || !directoryContracts) return;
    const key = `${watchCounterpartyId}|${watchCounterpartyType}|${watchCounterpartyRole}`;
    if (prevCounterpartyKeyRef.current === key) return;
    const changedParty = Boolean(prevCounterpartyKeyRef.current);
    prevCounterpartyKeyRef.current = key;
    if (!changedParty && form.getValues("contractId")) return;
    const selected = getLatestPriceContract(directoryContracts.filter((item) =>
      watchCounterpartyId && !item.deletedAt && (watchCounterpartyRole === COUNTERPARTY_ROLE.SUPPLIER
        ? item.supplierId === watchCounterpartyId
        : item.buyerId === watchCounterpartyId),
    ));
    form.setValue("contractId", selected?.id || "");
    form.setValue("contractNumber", selected?.contractNumber || "");
    form.setValue("contractAppendix", selected?.parentContractId ? selected.contractNumber : "");
  }, [open, watchCounterpartyId, watchCounterpartyType, watchCounterpartyRole, editPrice, contractsLoaded, directoryContracts, form]);

  const { data: bases } = useQuery<Base[]>({ queryKey: ["/api/bases"] });
  const { data: suppliers } = useQuery<Supplier[]>({
    queryKey: ["/api/suppliers"],
  });
  const { data: customers } = useQuery<Customer[]>({
    queryKey: ["/api/customers"],
  });
  const { data: currencies } = useQuery<Currency[]>({
    queryKey: ["/api/currencies"],
  });

  const isTransportation = watchCounterpartyType === COUNTERPARTY_TYPE.TRANSPORTATION;

  const allBases = isTransportation
    ? bases || []
    : bases?.filter((b) => b.baseType === watchCounterpartyType) || [];

  const availableSuppliers = isTransportation
    ? suppliers || []
    : suppliers?.filter((s) => allBases.find((b) => s.baseIds?.includes(b.id))) || [];

  const contractors = (
    watchCounterpartyRole === COUNTERPARTY_ROLE.SUPPLIER
      ? availableSuppliers
      : watchCounterpartyType === COUNTERPARTY_TYPE.REFUELING_ABROAD
        ? customers?.filter((c) => c.isForeign) || []
        : customers || []
  ) as (Supplier | Customer)[];

  // Для перевозки — все базисы без фильтрации по контрагенту
  const availableBases = (() => {
    if (isTransportation) return allBases;
    const contractor = contractors?.find((s) => s.id === watchCounterpartyId);
    if (contractor && contractor.baseIds && contractor.baseIds.length > 0) {
      return allBases.filter((b) => contractor.baseIds?.includes(b.id));
    }
    return allBases;
  })();

  // Автоматически выбираем первый базис для поставщика (не для перевозки)
  useEffect(() => {
    if (watchCounterpartyId && !editPrice && !isTransportation) {
      const contractor = contractors?.find((s) => s.id === watchCounterpartyId);
      if (contractor && contractor.baseIds && contractor.baseIds.length > 0) {
        const firstBaseId = contractor.baseIds[0];
        const firstBase = allBases.find((b) => b.id === firstBaseId);
        if (firstBase && !watchBasis) {
          form.setValue("basis", firstBase.name);
          form.setValue("basisId", firstBase.id);
        }
      }
    }
  }, [watchCounterpartyId, contractors, allBases, form, watchBasis, editPrice, isTransportation]);

  // При выборе типа сделки "Перевозка" — фиксируем роль "Покупатель" и продукт "Керосин"
  useEffect(() => {
    if (!editPrice && watchCounterpartyType === COUNTERPARTY_TYPE.TRANSPORTATION) {
      form.setValue("counterpartyRole", COUNTERPARTY_ROLE.BUYER);
      form.setValue("productType", PRODUCT_TYPE.KEROSENE);
    }
  }, [watchCounterpartyType, editPrice, form]);

  // Установка валюты по умолчанию при смене типа сделки
  useEffect(() => {
    if (!editPrice && currencies) {
      if (watchCounterpartyType === COUNTERPARTY_TYPE.REFUELING_ABROAD) {
        const usd = currencies.find((c) => c.code === "USD");
        if (usd) {
          form.setValue("currencyId", usd.id);
          form.setValue("currency", "USD");
        }
      } else {
        const rub = currencies.find((c) => c.code === "RUB");
        if (rub) {
          form.setValue("currencyId", rub.id);
          form.setValue("currency", "RUB");
        }
      }
    }
  }, [watchCounterpartyType, currencies, form, editPrice]);

  const handleCheckDates = () => {
    if (!watchCounterpartyId || !watchBasis || !watchDateFrom || !watchDateTo) {
      showError("Заполните все обязательные поля");
      return;
    }

    dateCheck.check({
      counterpartyId: watchCounterpartyId,
      counterpartyType: watchCounterpartyType,
      counterpartyRole: watchCounterpartyRole,
      basis: watchBasis,
      basisId: watchBasisId,
      loadingBasisId: watchLoadingBasisId,
      productType: watchProductType,
      nomenclatureId: watchNomenclatureId,
      dateFrom: watchDateFrom,
      dateTo: watchDateTo,
      excludeId: editPrice?.id,
    });
  };

  // Следим за результатом проверки дат
  useEffect(() => {
    if (dateCheck.result) {
      if (dateCheck.result.status === "ok") {
        setDateCheckPassed(true);
        toast({
          title: "Проверка пройдена",
          description: "Можно создать цену",
        });
      } else {
        setDateCheckPassed(false);
      }
    }
  }, [dateCheck.result, toast]);

  const createMutation = useMutation({
    mutationFn: async (data: PriceFormData) => {
      if (!editPrice && isPriceContractRequired(data.counterpartyType) && !data.contractId) throw new Error("Выберите договор из справочника");
      if (!editPrice && ["kerosene", "pvkj", "service"].includes(data.productType) && !data.nomenclatureId) {
        throw new Error("Выберите номенклатуру");
      }
      const payload = {
        productType: data.productType,
        nomenclatureId: data.nomenclatureId || null,
        contractId: data.contractId || null,
        counterpartyId: data.counterpartyId,
        counterpartyType: data.counterpartyType,
        counterpartyRole: data.counterpartyRole,
        basis: data.basis,
        basisId: data.basisId || null,
        loadingBasisId: data.loadingBasisId || null,
        currency: data.currency,
        currencyId: data.currencyId || null,
        limitType: data.limitType || "volume",
        contractVolume: {
          limitUnit: "tonne" as const,
          limit:
            !data.contractLimitEnabled || data.limitType === "amount" || !data.volume
              ? null
              : editPrice?.contractVolume?.limit !== null &&
                  editPrice?.contractVolume?.limit !== undefined &&
                  Number(data.volume).toFixed(5) ===
                    editPrice.contractVolume.limit.toFixed(5)
                ? editPrice.contractVolume.limit
                : Number(data.volume),
        },
        maxDealAmount: (!data.contractLimitEnabled || data.limitType !== "amount") ? null : (data.maxDealAmount || null),
        priceRate: {
          unit: data.priceUnit || "tonne",
          values: data.priceValues.map((value, index) => {
            const parsedValue = Number(value.price);
            const originalRate = editPrice?.priceRate;
            const originalValue =
              originalRate && originalRate.unit === (data.priceUnit || "tonne")
                ? originalRate.values[index]
                : undefined;
            return originalValue !== null &&
              originalValue !== undefined &&
              parsedValue.toFixed(2) === originalValue.toFixed(2)
              ? originalValue
              : parsedValue;
          }),
        },
        dateFrom: format(data.dateFrom, "yyyy-MM-dd"),
        dateTo: format(data.dateTo, "yyyy-MM-dd"),
        contractNumber: data.contractNumber || null,
        contractAppendix: data.contractAppendix || null,
        notes: data.notes || null,
        contractLimitEnabled: data.contractLimitEnabled !== false,
      };
      if (editPrice) {
        const res = await apiRequest(
          "PATCH",
          `/api/prices/${editPrice.id}`,
          payload,
        );
        return res.json();
      } else {
        const res = await apiRequest("POST", "/api/prices", payload);
        return res.json();
      }
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/prices/list"] });
      queryClient.invalidateQueries({ queryKey: ["/api/prices/find-active"] });
      queryClient.invalidateQueries({
        queryKey: ["/api/storage-cards/advances"],
      });
      // Invalidate contract info cache so the next form open fetches fresh data
      queryClient.invalidateQueries({ queryKey: ["/api/prices/last-contract-info"] });
      if (data.id) {
        queryClient.invalidateQueries({ queryKey: ["/api/prices", data.id] });
      }
      toast({
        title: editPrice ? "Цена обновлена" : "Цена добавлена",
        description: editPrice
          ? "Цена успешно обновлена"
          : "Новая цена успешно сохранена",
      });
      form.reset({
        dateFrom: new Date(),
        dateTo: getDefaultDateTo(),
        counterpartyType: COUNTERPARTY_TYPE.WHOLESALE,
        counterpartyRole: COUNTERPARTY_ROLE.SUPPLIER,
        counterpartyId: "",
        productType: PRODUCT_TYPE.KEROSENE,
        nomenclatureId: "",
        contractId: "",
        basis: "",
        basisId: undefined,
        loadingBasisId: undefined,
        currency: "RUB",
        currencyId: undefined,
        limitType: "volume" as "volume" | "amount",
        volume: "",
        maxDealAmount: "",
        priceValues: [{ price: "" }],
        contractNumber: "",
        contractAppendix: "",
        notes: "",
        priceUnit: "tonne" as "tonne" | "liter",
        contractLimitEnabled: true,
      });
      dateCheck.setResult(null);
      setDateCheckPassed(false);
      setOpen(false);
      if (onCreated && data?.id) {
        onCreated(data.id);
      }
      if (onEditComplete) {
        onEditComplete();
      }
    },
    onError: (error: Error) => {
      showError(error, "price");
    },
  });

  const handleSubmit = async (data: PriceFormData) => {
    // Если проверка показала ошибку пересечения дат, блокируем создание
    if (dateCheck.result && dateCheck.result.status === "error") {
      showError("Исправьте даты перед созданием цены — обнаружено пересечение периодов");
      return;
    }

    // Если проверка еще не была пройдена, запускаем ее автоматически
    if (!dateCheckPassed) {
      if (
        !watchCounterpartyId ||
        !watchBasis ||
        !watchDateFrom ||
        !watchDateTo
      ) {
        showError("Заполните все обязательные поля");
        return;
      }

      // Запускаем проверку
      const checkParams = {
        counterpartyId: watchCounterpartyId,
        counterpartyType: watchCounterpartyType,
        counterpartyRole: watchCounterpartyRole,
        basis: watchBasis,
        basisId: watchBasisId,
        loadingBasisId: watchLoadingBasisId,
        productType: watchProductType,
        dateFrom: watchDateFrom,
        dateTo: watchDateTo,
        excludeId: editPrice?.id,
      };

      try {
        const result = await dateCheck.checkAsync(checkParams);

        if (result && result.status === "error") {
          showError(result.message);
          return;
        }
      } catch (error) {
        showError("Не удалось проверить даты");
        return;
      }
    }

    createMutation.mutate(data);
  };

  // Хук сворачивания для standalone (не-inline) режима
  const standaloneTitle = editPrice ? "Редактирование цены" : "Новая цена";
  const handleStandaloneClose = () => {
    setOpen(false);
    form.reset({
      dateFrom: new Date(),
      dateTo: getDefaultDateTo(),
      counterpartyType: COUNTERPARTY_TYPE.WHOLESALE,
      counterpartyRole: COUNTERPARTY_ROLE.SUPPLIER,
      counterpartyId: "",
      productType: PRODUCT_TYPE.KEROSENE,
      basis: "",
      basisId: undefined,
      loadingBasisId: undefined,
      currency: "RUB",
      currencyId: undefined,
      limitType: "volume" as "volume" | "amount",
      volume: "",
      maxDealAmount: "",
      priceValues: [{ price: "" }],
      contractNumber: "",
      contractAppendix: "",
      notes: "",
      priceUnit: "tonne" as "tonne" | "liter",
      contractLimitEnabled: true,
    });
    dateCheck.setResult(null);
    setDateCheckPassed(false);
    if (onEditComplete) onEditComplete();
  };
  const {
    isMinimized: isMinimizedStandalone,
    MinimizeButton: MinimizeButtonStandalone,
    MinimizedBar: MinimizedBarStandalone,
  } = useMinimizableDialog({ title: standaloneTitle, onClose: handleStandaloneClose });

  // Ref-флаг: при программном сворачивании блокируем вызов setOpen(false) в onOpenChange.
  // Radix Dialog в режиме controlled НЕ вызывает onOpenChange при изменении open-пропа,
  // но держим ref как страховку на случай edge-cases разных версий Radix.
  const isMinimizingRef = useRef(false);

  const handleMinimize = () => {
    isMinimizingRef.current = true;
    setIsMinimized(true);
  };

  const handleCloseDialog = () => {
    if (setOpen) setOpen(false);
  };

  const handleDialogOpenChange = (isOpen: boolean) => {
    if (!isOpen) {
      if (isMinimizingRef.current) {
        // Это программное закрытие при сворачивании — игнорируем
        isMinimizingRef.current = false;
        return;
      }
      if (setOpen) setOpen(false);
      form.reset({
        dateFrom: new Date(),
        dateTo: getDefaultDateTo(),
        counterpartyType: COUNTERPARTY_TYPE.WHOLESALE,
        counterpartyRole: COUNTERPARTY_ROLE.SUPPLIER,
        counterpartyId: "",
        productType: PRODUCT_TYPE.KEROSENE,
        basis: "",
        basisId: undefined,
        loadingBasisId: undefined,
        currency: "RUB",
        currencyId: undefined,
        limitType: "volume" as "volume" | "amount",
        volume: "",
        maxDealAmount: "",
        priceValues: [{ price: "" }],
        contractNumber: "",
        contractAppendix: "",
        notes: "",
        contractLimitEnabled: true,
      });
      dateCheck.setResult(null);
      setDateCheckPassed(false);
      if (onEditComplete) {
        onEditComplete();
      }
    }
  };

  // Inline режим: используем Radix Dialog с open={!isMinimized}.
  // При сворачивании: setIsMinimized(true) → open становится false → Dialog скрывается.
  // Radix в controlled-режиме НЕ вызывает onOpenChange при изменении open-пропа.
  // При разворачивании: клик по свёрнутой полоске — нативный pointerdown блокируется
  // stopImmediatePropagation ДО того, как Radix DismissableLayer родительского диалога
  // (ОПТ/Перевозки) успеет его обработать и ошибочно посчитать кликом "вне диалога".
  if (isInline) {
    return (
      <>
        <Dialog
          open={open && !isMinimized}
          onOpenChange={handleDialogOpenChange}
          modal={false}
        >
          <DialogContent
            className="max-w-2xl max-h-[90vh] overflow-y-auto"
            onPointerDownOutside={(e) => e.preventDefault()}
            onInteractOutside={(e) => e.preventDefault()}
            onWheel={(e) => e.stopPropagation()}
          >
            <DialogHeader>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <DialogTitle>
                    {editPrice ? "Редактирование цены" : "Новая цена"}
                  </DialogTitle>
                  <DialogDescription>
                    Добавление или редактирование цены покупки или продажи
                  </DialogDescription>
                </div>
                <div className="flex items-center gap-1 shrink-0 mt-[-4px]">
                  <Button
                    size="icon"
                    variant="ghost"
                    type="button"
                    onClick={handleMinimize}
                    title="Свернуть"
                  >
                    <Minus className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </DialogHeader>
            <Form {...form}>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  form.handleSubmit(handleSubmit)(e);
                }}
                className="space-y-4"
              >
                <PriceFormFields
                  preserveLegacySelection={!!editPrice && !editPrice.nomenclatureId}
                  control={form.control}
                  setValue={form.setValue}
                  contractors={contractors}
                  availableBases={availableBases}
                  currencies={currencies || []}
                  fields={fields}
                  remove={remove}
                  append={append}
                />

                <PriceChecksPanel
                  dateCheckResult={dateCheck.result}
                  onCheckDates={handleCheckDates}
                  isChecking={dateCheck.isChecking}
                  dateCheckPassed={dateCheckPassed}
                />

                <div className="flex justify-end gap-2 pt-2 pb-1">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleCloseDialog}
                  >
                    Отмена
                  </Button>
                  <Button
                    type="submit"
                    disabled={createMutation.isPending || !dateCheckPassed}
                  >
                    {createMutation.isPending ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : null}
                    Создать
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>

        {/* Свёрнутая полоска — через портал в document.body:
            position:fixed корректно позиционируется относительно viewport,
            а не трансформированного предка (Radix Dialog). */}
        {open && isMinimized && createPortal(
          <div
            className="fixed bottom-0 right-6 z-[9991] bg-background border border-border rounded-t-md shadow-xl flex items-center px-4 py-2.5 gap-2 min-w-[260px] select-none"
            style={{
              cursor: "pointer",
              // Radix modal dialogs set pointer-events:none on body to block the background.
              // Elements portaled to body inherit this. We must explicitly override it so
              // the bar remains clickable while a parent modal dialog is open.
              pointerEvents: "auto",
            }}
            onPointerDown={(e) => {
              // Prevent Radix DismissableLayer from interpreting this click as
              // "outside" the parent dialog and closing it.
              e.stopPropagation();
              e.nativeEvent.stopImmediatePropagation();
            }}
            onClick={(e) => {
              e.stopPropagation();
              isMinimizingRef.current = false;
              setIsMinimized(false);
            }}
          >
            <span className="text-sm font-medium flex-1 truncate">
              {editPrice ? "Редактирование цены" : "Новая цена"}
            </span>
            <Button
              size="icon"
              variant="ghost"
              type="button"
              style={{ pointerEvents: "auto" }}
              onPointerDown={(e) => {
                e.stopPropagation();
                e.nativeEvent.stopImmediatePropagation();
              }}
              onClick={(e) => {
                e.stopPropagation();
                isMinimizingRef.current = false;
                setIsMinimized(false);
              }}
              title="Развернуть"
            >
              <ChevronUp className="h-4 w-4" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              type="button"
              style={{ pointerEvents: "auto" }}
              onPointerDown={(e) => {
                e.stopPropagation();
                e.nativeEvent.stopImmediatePropagation();
              }}
              onClick={(e) => {
                e.stopPropagation();
                handleCloseDialog();
              }}
              title="Закрыть"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>,
          document.body,
        )}

        <ErrorModalComponent />
      </>
    );
  }

  return (
    <>
    <MinimizableDialog
      open={open || !!editPrice}
      isMinimized={isMinimizedStandalone}
      onOpenChange={(isOpen) => {
        if (isOpen) {
          setOpen(true);
        } else {
          handleStandaloneClose();
        }
      }}
    >
      {!editPrice && !isInline && (
        <DialogTrigger asChild>
          <Button data-testid="button-add-price">
            <Plus className="mr-2 h-4 w-4" />
            Добавить цену
          </Button>
        </DialogTrigger>
      )}
      <MinimizableDialogContent isMinimized={isMinimizedStandalone} className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-start justify-between gap-2">
            <div>
              <DialogTitle>
                {editPrice ? "Редактирование цены" : "Новая цена"}
              </DialogTitle>
              <DialogDescription>
                Добавление или редактирование цены покупки или продажи
              </DialogDescription>
            </div>
            <div className="shrink-0 mt-[-4px]">{MinimizeButtonStandalone}</div>
          </div>
        </DialogHeader>
        <Form {...form}>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              e.stopPropagation();
              form.handleSubmit(handleSubmit)(e);
            }}
            className="space-y-4"
          >
            <PriceFormFields
              preserveLegacySelection={!!editPrice && !editPrice.nomenclatureId}
              control={form.control}
              setValue={form.setValue}
              contractors={contractors}
              availableBases={availableBases}
              currencies={currencies || []}
              fields={fields}
              remove={remove}
              append={append}
            />

            <PriceChecksPanel
              dateCheckResult={dateCheck.result}
              onCheckDates={handleCheckDates}
              isChecking={dateCheck.isChecking}
              dateCheckPassed={dateCheckPassed}
            />

            <div className="flex justify-end gap-4 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={handleStandaloneClose}
              >
                Отмена
              </Button>
              <Button
                type="submit"
                disabled={createMutation.isPending}
                data-testid={
                  editPrice ? "button-save-edit-price" : "button-save-price"
                }
                onClick={(e) => e.stopPropagation()}
              >
                {createMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {editPrice ? "Сохранение..." : "Создание..."}
                  </>
                ) : editPrice ? (
                  "Сохранить"
                ) : (
                  "Создать"
                )}
              </Button>
            </div>
          </form>
        </Form>
      </MinimizableDialogContent>
    </MinimizableDialog>
    {MinimizedBarStandalone}
    {!isInline && <ErrorModalComponent />}
  </>
  );
}
