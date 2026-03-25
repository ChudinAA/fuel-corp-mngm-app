import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { format } from "date-fns";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useErrorModal } from "@/hooks/use-error-modal";
import { Button } from "@/components/ui/button";
import {
  Dialog,
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
import { priceFormSchema } from "../schemas";
import type { PriceFormData, PriceDialogProps } from "../types";
import { useDateCheck } from "../hooks/use-date-check";
import { PriceFormFields } from "./price-form-fields";
import { PriceChecksPanel } from "./price-checks-panel";

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
      basis: "",
      basisId: undefined,
      loadingBasisId: undefined,
      volume: "",
      priceValues: [{ price: "" }],
      contractNumber: "",
      notes: "",
      priceUnit: "kg" as "kg" | "liter",
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "priceValues",
  });

  useEffect(() => {
    if (editPrice) {
      let parsedPriceValues = [{ price: "" }];
      if (editPrice.priceValues && editPrice.priceValues.length > 0) {
        try {
          parsedPriceValues = editPrice.priceValues.map((pv: string) => {
            const parsed = JSON.parse(pv);
            return { price: String(parsed.price || "") };
          });
        } catch (e) {
          console.error("Failed to parse priceValues:", e);
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
        basis: editPrice.basis || "",
        basisId: editPrice.basisId || undefined,
        loadingBasisId: editPrice.loadingBasisId || undefined,
        currency: editPrice.currency || "RUB",
        currencyId: editPrice.currencyId || undefined,
        volume: editPrice.volume || "",
        priceValues: parsedPriceValues,
        contractNumber: editPrice.contractNumber || "",
        notes: editPrice.notes || "",
        priceUnit: (editPrice.priceUnit as "kg" | "liter") || "kg",
      } as PriceFormData);
      setOpen(true);
      setDateCheckPassed(false);
    }
  }, [editPrice, form]);

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
        volume: "",
        priceValues: [{ price: "" }],
        contractNumber: "",
        notes: "",
        priceUnit: "kg" as "kg" | "liter",
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
    watchDateFrom,
    watchDateTo,
  ]);

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
      const payload = {
        productType: data.productType,
        counterpartyId: data.counterpartyId,
        counterpartyType: data.counterpartyType,
        counterpartyRole: data.counterpartyRole,
        basis: data.basis,
        basisId: data.basisId || null,
        loadingBasisId: data.loadingBasisId || null,
        currency: data.currency,
        currencyId: data.currencyId || null,
        volume: data.volume || null,
        priceValues: data.priceValues,
        dateFrom: format(data.dateFrom, "yyyy-MM-dd"),
        dateTo: format(data.dateTo, "yyyy-MM-dd"),
        contractNumber: data.contractNumber || null,
        notes: data.notes || null,
        priceUnit: data.priceUnit || "kg",
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
        basis: "",
        basisId: undefined,
        loadingBasisId: undefined,
        currency: "RUB",
        currencyId: undefined,
        volume: "",
        priceValues: [{ price: "" }],
        contractNumber: "",
        notes: "",
        priceUnit: "kg" as "kg" | "liter",
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

  // Inline режим: Dialog с кнопкой свернуть + portal для свёрнутого состояния
  if (isInline) {
    if (!open) return <ErrorModalComponent />;

    // Свёрнутый режим: плавающая полоска через portal на уровне document.body
    if (isMinimized) {
      return createPortal(
        <>
          <div
            className="fixed bottom-0 right-6 z-[99999] bg-background border border-border rounded-t-md shadow-xl flex items-center px-4 py-2.5 gap-2 min-w-[260px] cursor-pointer select-none"
            onClick={() => setIsMinimized(false)}
          >
            <span className="text-sm font-medium flex-1 truncate">
              {editPrice ? "Редактирование цены" : "Новая цена"}
            </span>
            <Button
              size="icon"
              variant="ghost"
              type="button"
              onClick={(e) => { e.stopPropagation(); setIsMinimized(false); }}
              title="Развернуть"
            >
              <ChevronUp className="h-4 w-4" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              type="button"
              onClick={(e) => { e.stopPropagation(); if (setOpen) setOpen(false); }}
              title="Закрыть"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          <ErrorModalComponent />
        </>,
        document.body,
      );
    }

    // Развёрнутый режим: обычный Dialog с кнопкой «Свернуть» в заголовке
    return (
      <>
        <Dialog
          open={true}
          onOpenChange={(isOpen) => { if (!isOpen && setOpen) setOpen(false); }}
        >
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <div className="flex items-center justify-between gap-2">
                <div>
                  <DialogTitle>
                    {editPrice ? "Редактирование цены" : "Новая цена"}
                  </DialogTitle>
                  <DialogDescription>
                    Добавление или редактирование цены покупки или продажи
                  </DialogDescription>
                </div>
                <Button
                  size="icon"
                  variant="ghost"
                  type="button"
                  onClick={() => setIsMinimized(true)}
                  title="Свернуть"
                >
                  <Minus className="h-4 w-4" />
                </Button>
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
                  control={form.control}
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
                    onClick={() => { if (setOpen) setOpen(false); }}
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
        <ErrorModalComponent />
      </>
    );
  }

  return (
    <>
    <Dialog
      open={open || !!editPrice}
      onOpenChange={(isOpen) => {
        setOpen(isOpen);
        if (!isOpen) {
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
            volume: "",
            priceValues: [{ price: "" }],
            contractNumber: "",
            notes: "",
          });
          dateCheck.setResult(null);
          setDateCheckPassed(false);
          if (onEditComplete) {
            onEditComplete();
          }
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
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {editPrice ? "Редактирование цены" : "Новая цена"}
          </DialogTitle>
          <DialogDescription>
            Добавление или редактирование цены покупки или продажи
          </DialogDescription>
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
              control={form.control}
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
                onClick={() => {
                  setOpen(false);
                  if (onEditComplete) {
                    onEditComplete();
                  }
                }}
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
      </DialogContent>
    </Dialog>
    {!isInline && <ErrorModalComponent />}
  </>
  );
}
