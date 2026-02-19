import { useState, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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

export function AddRefuelingDialog({
  isOpen,
  onClose,
  editRefueling,
  isCopy,
}: AddRefuelingDialogProps) {
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const formRef = useRef<RefuelingFormHandle>(null);

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      const formState = formRef.current?.getFormState();
      const isDirty = formRef.current?.isDirty();
      const isNewRefueling = !editRefueling && !isCopy;
      const isDraftEdit = !!editRefueling && editRefueling.isDraft;

      // Если это создание новой заправки и введен поставщик или покупатель
      // ИЛИ если это редактирование существующего черновика и были изменения
      if (
        (isNewRefueling &&
          formState &&
          formState.supplierId &&
          formState.buyerId) ||
        (isDraftEdit && isDirty)
      ) {
        setShowExitConfirm(true);
      } else {
        onClose();
      }
    }
  };

  const handleSaveDraft = async () => {
    if (formRef.current) {
      await formRef.current.saveAsDraft();
      setShowExitConfirm(false);
      onClose();
    }
  };

  const handleDiscard = () => {
    setShowExitConfirm(false);
    onClose();
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={handleOpenChange}>
        <DialogContent className="sm:max-w-[950px] h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {isCopy
                ? "Копирование заправки"
                : editRefueling
                  ? "Редактирование заправки"
                  : "Новая заправка ВС"}
            </DialogTitle>
            <DialogDescription>
              {isCopy
                ? "Создание новой заправки на основе существующей"
                : editRefueling
                  ? "Измените данные существующей заправки"
                  : "Заполните данные для создания новой заправки ВС"}
            </DialogDescription>
          </DialogHeader>
          <RefuelingForm
            ref={formRef}
            onSuccess={onClose}
            editData={
              editRefueling
                ? isCopy
                  ? { ...editRefueling, id: undefined as any }
                  : editRefueling
                : null
            }
          />
        </DialogContent>
      </Dialog>

      <AlertDialog open={showExitConfirm} onOpenChange={setShowExitConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Сохранить черновик?</AlertDialogTitle>
            <AlertDialogDescription>
              Вы начали вводить данные. Хотите сохранить изменения как
              черновик перед закрытием?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleDiscard}>
              Нет
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleSaveDraft}>
              Да, сохранить
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
