
import { useState, useRef } from "react";
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogHeader, 
  DialogTitle 
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
import { OptForm, type OptFormHandle } from "./opt-form";
import type { AddOptDialogProps } from "../types";

export function AddOptDialog({
  isOpen,
  onClose,
  editOpt,
  isCopy,
}: AddOptDialogProps) {
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const formRef = useRef<OptFormHandle>(null);
  const { showError, ErrorModalComponent } = useErrorModal();

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      const formState = formRef.current?.getFormState();
      const isDirty = formRef.current?.isDirty();
      // Новая сделка ИЛИ копия — оба сценария требуют алерта при наличии данных
      const isNewOrCopy = !editOpt || !!isCopy;
      const isDraftEdit = !!editOpt && !isCopy && editOpt.isDraft;

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
        <DialogContent className="sm:max-w-[950px] h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {isCopy ? "Копирование сделки" : editOpt ? "Редактирование сделки" : "Новая сделка"}
            </DialogTitle>
            <DialogDescription>
              {isCopy 
                ? "Создание новой сделки на основе существующей" 
                : editOpt 
                  ? "Измените данные существующей оптовой сделки" 
                  : "Заполните данные для создания новой оптовой сделки"}
            </DialogDescription>
          </DialogHeader>
          <OptForm 
            ref={formRef}
            onSuccess={onClose} 
            editData={editOpt ? (isCopy ? { ...editOpt, id: undefined as any } : editOpt) : null}
          />
        </DialogContent>
      </Dialog>

      <AlertDialog open={showExitConfirm} onOpenChange={setShowExitConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Сохранить черновик?</AlertDialogTitle>
            <AlertDialogDescription>
              Вы начали вводить данные. Хотите сохранить изменения как черновик перед закрытием?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleDiscard}>Нет</AlertDialogCancel>
            <AlertDialogAction onClick={handleSaveDraft}>Да, сохранить</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <ErrorModalComponent />
    </>
  );
}
