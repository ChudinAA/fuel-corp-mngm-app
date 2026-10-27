import { useState, useRef, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Dialog,
  MinimizableDialog,
  DialogContent,
  MinimizableDialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useMinimizableDialog } from "@/hooks/use-minimizable-dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { RefuelingForm, type RefuelingFormHandle } from "./refueling-form";
import type { AddRefuelingDialogProps } from "../types";
import { EQUIPMENT_TYPE } from "@shared/constants";
import { useErrorModal } from "@/hooks/use-error-modal";
import { apiRequest } from "@/lib/queryClient";
import type { RefuelingApi } from "../types";
import { PRODUCT_TYPE } from "@shared/constants";

export function AddRefuelingDialog({
  isOpen,
  onClose,
  editRefueling,
  isCopy,
  equipmentType = EQUIPMENT_TYPE.COMMON,
}: AddRefuelingDialogProps & { equipmentType?: string }) {
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const formRef = useRef<RefuelingFormHandle>(null);
  const { showError, ErrorModalComponent } = useErrorModal();
  const orderQuery = useQuery<RefuelingApi[]>({
    queryKey: ["/api/refueling/order", editRefueling?.id],
    queryFn: async () => {
      const response = await apiRequest("GET", `/api/refueling/order/${editRefueling!.id}`);
      return response.json();
    },
    enabled: isOpen && !!editRefueling?.id && !isCopy,
    staleTime: 30_000,
  });
  const [orderSnapshot, setOrderSnapshot] = useState<{
    id: string;
    deals: RefuelingApi[];
  } | null>(null);
  useEffect(() => {
    if (!isOpen || !editRefueling?.id || isCopy) {
      setOrderSnapshot(null);
      return;
    }
    if (orderQuery.isFetching || orderQuery.isError || !orderQuery.data) return;
    setOrderSnapshot((current) =>
      current?.id === editRefueling.id
        ? current
        : { id: editRefueling.id, deals: orderQuery.data },
    );
  }, [
    isOpen,
    editRefueling?.id,
    isCopy,
    orderQuery.isFetching,
    orderQuery.isError,
    orderQuery.data,
  ]);
  const snapshotMatches = orderSnapshot?.id === editRefueling?.id;
  const orderDeals = isCopy
    ? editRefueling ? [editRefueling] : []
    : snapshotMatches
      ? orderSnapshot?.deals || []
      : orderQuery.data || (editRefueling ? [editRefueling] : []);
  const isOrderLoading =
    !!editRefueling && !isCopy && !snapshotMatches && orderQuery.isFetching;
  const isOrderMissing =
    !!editRefueling &&
    !isCopy &&
    !orderQuery.isFetching &&
    (orderQuery.isError || orderQuery.data?.length === 0);
  const primaryDeal =
    orderDeals.find((deal) => deal.productType === PRODUCT_TYPE.KEROSENE) ||
    orderDeals[0] ||
    editRefueling;
  const dialogTitle = isCopy
    ? equipmentType === EQUIPMENT_TYPE.LIK ? "Копирование заправки ОП" : "Копирование заправки"
    : editRefueling
      ? equipmentType === EQUIPMENT_TYPE.LIK ? "Редактирование заправки ЛИК" : "Редактирование заправки"
      : equipmentType === EQUIPMENT_TYPE.LIK ? "Новая заправка ОП" : "Новая заправка ВС";
  const { isMinimized, MinimizeButton, MinimizedBar } = useMinimizableDialog({ title: dialogTitle, onClose });

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      const formState = formRef.current?.getFormState();
      const isDirty = formRef.current?.isDirty();

      // Показываем алерт для новых заявок И для копий (оба случая = несохранённые данные)
      const isNewOrCopy = !editRefueling || isCopy;
      const isDraftEdit = !!editRefueling && !isCopy && editRefueling.isDraft;

      // Хотя бы одно ключевое поле заполнено
      const hasKeyFields = !!(formState?.supplierId || formState?.buyerId);

      if ((isNewOrCopy && hasKeyFields) || (isDraftEdit && isDirty)) {
        setShowExitConfirm(true);
      } else {
        onClose();
      }
    }
  };

  const handleSaveDraft = async () => {
    const formState = formRef.current?.getFormState();
    const hasKeyFields = !!(formState?.supplierId || formState?.buyerId);
    if (!hasKeyFields) {
      showError(
        "Для сохранения черновика необходимо выбрать поставщика или покупателя.",
      );
      setShowExitConfirm(false);
      return;
    }
    if (formRef.current) {
      try {
        await formRef.current.saveAsDraft();
        setShowExitConfirm(false);
        onClose();
      } catch (error) {
        showError(error instanceof Error ? error : new Error("Не удалось сохранить черновик"), "refueling");
      }
    }
  };

  const handleDiscard = () => {
    setShowExitConfirm(false);
    onClose();
  };

  return (
    <>
      <MinimizableDialog isMinimized={isMinimized} open={isOpen} onOpenChange={handleOpenChange}>
        <MinimizableDialogContent isMinimized={isMinimized} className="sm:max-w-[950px] h-[80vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-start justify-between gap-2">
              <div>
                <DialogTitle>{dialogTitle}</DialogTitle>
                <DialogDescription>
                  {isCopy
                    ? "Создание новой заправки на основе существующей"
                    : editRefueling
                      ? "Измените данные существующей заправки"
                      : "Заполните данные для создания новой заправки ВС"}
                </DialogDescription>
              </div>
              <div className="shrink-0 mt-[-4px]">{MinimizeButton}</div>
            </div>
          </DialogHeader>
          {isOrderLoading ? (
            <div className="py-8 text-center text-sm text-muted-foreground">Загружаем все сделки заказа…</div>
          ) : isOrderMissing ? (
            <div className="py-8 text-center text-sm text-destructive">Не удалось загрузить состав заказа. Закройте окно и попробуйте ещё раз.</div>
          ) : (
            <RefuelingForm
              ref={formRef}
              onSuccess={onClose}
              equipmentType={equipmentType}
              editData={
                editRefueling
                  ? isCopy
                    ? { ...editRefueling, id: undefined as any }
                    : primaryDeal
                  : null
              }
              editDeals={editRefueling && !isCopy ? orderDeals : undefined}
            />
          )}
        </MinimizableDialogContent>
      </MinimizableDialog>
      {MinimizedBar}

      <AlertDialog open={showExitConfirm} onOpenChange={setShowExitConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Сохранить черновик?</AlertDialogTitle>
            <AlertDialogDescription>
              Вы начали вводить данные. Хотите сохранить изменения как черновик
              перед закрытием?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleDiscard}>Нет</AlertDialogCancel>
            <AlertDialogAction onClick={handleSaveDraft}>
              Да, сохранить
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <ErrorModalComponent />
    </>
  );
}
