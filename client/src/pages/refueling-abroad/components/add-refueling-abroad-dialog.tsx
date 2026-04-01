import { useState, useRef } from "react";
import {
  Dialog,
  DialogContent,
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
import { useErrorModal } from "@/hooks/use-error-modal";
import {
  RefuelingAbroadForm,
  type RefuelingAbroadFormHandle,
} from "./refueling-abroad-form";
import type { AddRefuelingAbroadDialogProps } from "../types";
import { ScrollArea } from "@/components/ui/scroll-area";

export function AddRefuelingAbroadDialog({
  isOpen,
  onClose,
  editRefueling,
  isCopy = false,
}: AddRefuelingAbroadDialogProps) {
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const formRef = useRef<RefuelingAbroadFormHandle>(null);
  const { showError, ErrorModalComponent } = useErrorModal();

  const title = editRefueling
    ? isCopy
      ? "Копировать заправку"
      : "Редактировать заправку"
    : "Новая заправка за рубежом";

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      const formState = formRef.current?.getFormState();
      const isDirty = formRef.current?.isDirty();
      // Новая заправка ИЛИ копия — оба сценария требуют алерта при наличии данных
      const isNewOrCopy = !editRefueling || isCopy;
      const isDraftEdit = !!editRefueling && !isCopy && editRefueling.isDraft;

      // Алерт показываем если заполнено хотя бы одно ключевое поле (поставщик ИЛИ покупатель)
      if (
        (isNewOrCopy && formState && (formState.supplierId || formState.buyerId)) ||
        (isDraftEdit && isDirty)
      ) {
        setShowExitConfirm(true);
      } else {
        onClose();
      }
    }
  };

  const handleSaveDraft = async () => {
    const formState = formRef.current?.getFormState();
    // Черновик можно сохранить только если заполнено хотя бы одно ключевое поле
    if (!formState?.supplierId && !formState?.buyerId) {
      showError("Для сохранения черновика необходимо заполнить хотя бы одно поле: Поставщик или Покупатель");
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
        <DialogContent className="max-w-7xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[calc(90vh-80px)] pr-4">
            <RefuelingAbroadForm
              ref={formRef}
              onSuccess={onClose}
              editData={
                isCopy
                  ? { ...editRefueling!, id: "", originalId: editRefueling?.id }
                  : editRefueling
              }
            />
          </ScrollArea>
        </DialogContent>
      </Dialog>

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
