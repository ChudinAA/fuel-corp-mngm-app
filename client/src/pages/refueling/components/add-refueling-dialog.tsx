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
import { EQUIPMENT_TYPE } from "@shared/constants";
import { useErrorModal } from "@/hooks/use-error-modal";

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
      showError("Для сохранения черновика необходимо выбрать поставщика или покупателя.");
      setShowExitConfirm(false);
      return;
    }
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
            equipmentType={equipmentType}
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

      <ErrorModalComponent />
    </>
  );
}
