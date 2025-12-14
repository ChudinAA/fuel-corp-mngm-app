
import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { format } from "date-fns";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form } from "@/components/ui/form";
import { Plus, Loader2 } from "lucide-react";
import type { Base, Supplier, Customer } from "@shared/schema";
import { priceFormSchema } from "../schemas";
import type { PriceFormData, PriceDialogProps } from "../types";
import { useDateCheck } from "../hooks/use-date-check";
import { PriceFormFields } from "./price-form-fields";
import { PriceChecksPanel } from "./price-checks-panel";

export function AddPriceDialog({ editPrice, onEditComplete }: PriceDialogProps) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [dateCheckPassed, setDateCheckPassed] = useState(false);

  const dateCheck = useDateCheck();

  const form = useForm<PriceFormData>({
    resolver: zodResolver(priceFormSchema),
    defaultValues: {
      dateFrom: new Date(),
      dateTo: new Date(),
      counterpartyType: "wholesale",
      counterpartyRole: "supplier",
      counterpartyId: "",
      productType: "kerosine",
      basis: "",
      volume: "",
      priceValues: [{ price: "" }],
      contractNumber: "",
      notes: "",
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "priceValues"
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

      const fieldsToRemove = fields.length;
      for (let i = 0; i < fieldsToRemove; i++) {
        remove(0);
      }
      
      parsedPriceValues.forEach((pv) => {
        append(pv);
      });

      form.reset({
        dateFrom: new Date(editPrice.dateFrom),
        dateTo: new Date(editPrice.dateTo || editPrice.dateFrom),
        counterpartyType: editPrice.counterpartyType,
        counterpartyRole: editPrice.counterpartyRole,
        counterpartyId: editPrice.counterpartyId,
        productType: editPrice.productType,
        basis: editPrice.basis || "",
        volume: editPrice.volume || "",
        priceValues: parsedPriceValues,
        contractNumber: editPrice.contractNumber || "",
        notes: editPrice.notes || "",
      });
      setOpen(true);
      setDateCheckPassed(false);
    }
  }, [editPrice, form, fields.length, append, remove]);

  const watchCounterpartyType = form.watch("counterpartyType");
  const watchCounterpartyRole = form.watch("counterpartyRole");
  const watchCounterpartyId = form.watch("counterpartyId");
  const watchDateFrom = form.watch("dateFrom");
  const watchDateTo = form.watch("dateTo");
  const watchBasis = form.watch("basis");
  const watchProductType = form.watch("productType");

  // Сбрасывать проверку дат при изменении критических полей
  useEffect(() => {
    setDateCheckPassed(false);
    dateCheck.setResult(null);
  }, [watchCounterpartyId, watchBasis, watchProductType, watchDateFrom, watchDateTo]);

  const { data: bases } = useQuery({ queryKey: ["/api/bases"] });
  const { data: suppliers } = useQuery({ queryKey: ["/api/suppliers"] });
  const { data: customers } = useQuery<Customer[]>({ queryKey: ["/api/customers"] });

  const allBases = bases || [];
  const contractors = watchCounterpartyRole === "supplier" 
    ? suppliers || []
    : customers || [];

  // Фильтруем базисы для поставщика
  const availableBases = watchCounterpartyRole === "supplier" && watchCounterpartyId
    ? (() => {
        const supplier = suppliers?.find(s => s.id === watchCounterpartyId);
        if (supplier && supplier.baseIds && supplier.baseIds.length > 0) {
          return allBases.filter(b => supplier.baseIds.includes(b.id));
        }
        return [];
      })()
    : allBases;

  // Автоматически выбираем первый базис для поставщика
  useEffect(() => {
    if (watchCounterpartyRole === "supplier" && watchCounterpartyId && !editPrice) {
      const supplier = suppliers?.find(s => s.id === watchCounterpartyId);
      if (supplier && supplier.baseIds && supplier.baseIds.length > 0) {
        const firstBase = allBases.find(b => b.id === supplier.baseIds[0]);
        if (firstBase && !watchBasis) {
          form.setValue("basis", firstBase.name);
        }
      }
    }
  }, [watchCounterpartyRole, watchCounterpartyId, suppliers, allBases, form, watchBasis, editPrice]);

  const handleCheckDates = () => {
    if (!watchCounterpartyId || !watchBasis || !watchDateFrom || !watchDateTo) {
      toast({ title: "Ошибка", description: "Заполните все обязательные поля", variant: "destructive" });
      return;
    }
    
    dateCheck.check({
      counterpartyId: watchCounterpartyId,
      counterpartyType: watchCounterpartyType,
      counterpartyRole: watchCounterpartyRole,
      basis: watchBasis,
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
        toast({ title: "Проверка пройдена", description: "Можно создать цену" });
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
        volume: data.volume || null,
        priceValues: data.priceValues,
        dateFrom: format(data.dateFrom, "yyyy-MM-dd"),
        dateTo: format(data.dateTo, "yyyy-MM-dd"),
        contractNumber: data.contractNumber || null,
        notes: data.notes || null,
      };
      if (editPrice) {
        const res = await apiRequest("PATCH", `/api/prices/${editPrice.id}`, payload);
        return res.json();
      } else {
        const res = await apiRequest("POST", "/api/prices", payload);
        return res.json();
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/prices"] });
      toast({ title: editPrice ? "Цена обновлена" : "Цена добавлена", description: editPrice ? "Цена успешно обновлена" : "Новая цена успешно сохранена" });
      form.reset({
        dateFrom: new Date(),
        dateTo: new Date(),
        counterpartyType: "wholesale",
        counterpartyRole: "supplier",
        counterpartyId: "",
        productType: "kerosine",
        basis: "",
        volume: "",
        priceValues: [{ price: "" }],
        contractNumber: "",
        notes: "",
      });
      dateCheck.setResult(null);
      setDateCheckPassed(false);
      setOpen(false);
      if (onEditComplete) {
        onEditComplete();
      }
    },
    onError: (error: Error) => {
      toast({ title: "Ошибка", description: error.message, variant: "destructive" });
    },
  });

  const handleSubmit = async (data: PriceFormData) => {
    // Если проверка показала ошибку пересечения дат, блокируем создание
    if (dateCheck.result && dateCheck.result.status === "error") {
      toast({ 
        title: "Ошибка пересечения дат!", 
        description: "Исправьте даты перед созданием цены", 
        variant: "destructive"
      });
      return;
    }

    // Если проверка еще не была пройдена, запускаем ее автоматически
    if (!dateCheckPassed) {
      if (!watchCounterpartyId || !watchBasis || !watchDateFrom || !watchDateTo) {
        toast({ title: "Ошибка", description: "Заполните все обязательные поля", variant: "destructive" });
        return;
      }
      
      // Запускаем проверку
      const checkParams = {
        counterpartyId: watchCounterpartyId,
        counterpartyType: watchCounterpartyType,
        counterpartyRole: watchCounterpartyRole,
        basis: watchBasis,
        productType: watchProductType,
        dateFrom: watchDateFrom,
        dateTo: watchDateTo,
        excludeId: editPrice?.id,
      };
      
      try {
        await dateCheck.checkAsync(checkParams);
        // Проверяем результат после выполнения
        const result = await new Promise<any>((resolve) => {
          // Небольшая задержка для получения результата
          setTimeout(() => resolve(dateCheck.result), 100);
        });
        
        if (result && result.status === "error") {
          toast({ 
            title: "Ошибка пересечения дат!", 
            description: result.message, 
            variant: "destructive"
          });
          return;
        }
      } catch (error) {
        toast({ 
          title: "Ошибка!", 
          description: "Не удалось проверить даты", 
          variant: "destructive"
        });
        return;
      }
    }
    
    createMutation.mutate(data);
  };

  return (
    <Dialog open={open || !!editPrice} onOpenChange={(isOpen) => {
      setOpen(isOpen);
      if (!isOpen) {
        form.reset({
          dateFrom: new Date(),
          dateTo: new Date(),
          counterpartyType: "wholesale",
          counterpartyRole: "supplier",
          counterpartyId: "",
          productType: "kerosine",
          basis: "",
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
    }}>
      {!editPrice && (
        <DialogTrigger asChild>
          <Button data-testid="button-add-price">
            <Plus className="mr-2 h-4 w-4" />
            Добавить цену
          </Button>
        </DialogTrigger>
      )}
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editPrice ? "Редактирование цены" : "Новая цена"}</DialogTitle>
          <DialogDescription>Добавление или редактирование цены покупки или продажи</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <PriceFormFields
              control={form.control}
              contractors={contractors}
              availableBases={availableBases}
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
              <Button type="button" variant="outline" onClick={() => {
                setOpen(false);
                if (onEditComplete) {
                  onEditComplete();
                }
              }}>Отмена</Button>
              <Button 
                type="submit" 
                disabled={createMutation.isPending}
                data-testid={editPrice ? "button-save-edit-price" : "button-save-price"}
              >
                {createMutation.isPending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />{editPrice ? "Сохранение..." : "Создание..."}</> : (editPrice ? "Сохранить" : "Создать")}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
