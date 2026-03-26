import { useRef, useState } from "react";
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
import { useErrorModal } from "@/hooks/use-error-modal";
import { TransportationForm, type TransportationFormHandle } from "./transportation-form";

interface TransportationDialogProps {
  isOpen: boolean;
  onClose: () => void;
  editItem?: any | null;
  isCopy?: boolean;
}

export function TransportationDialog({
  isOpen,
  onClose,
  editItem,
  isCopy,
}: TransportationDialogProps) {
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const formRef = useRef<TransportationFormHandle>(null);
  const { showError, ErrorModalComponent } = useErrorModal();

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      const formState = formRef.current?.getFormState();
      const isDirty = formRef.current?.isDirty();
      // Новая сделка ИЛИ копия — оба сценария требуют алерта при наличии данных
      const isNewOrCopy = !editItem || !!isCopy;
      const isDraftEdit = !!editItem && !isCopy && editItem.isDraft;

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

  const title = isCopy
    ? "Копирование перевозки"
    : editItem
    ? "Редактирование перевозки"
    : "Новая перевозка";

  const description = isCopy
    ? "Создание новой перевозки на основе существующей"
    : editItem
    ? "Измените данные сделки по перевозке"
    : "Заполните данные для создания новой сделки по перевозке";

  return (
    <>
      <Dialog open={isOpen} onOpenChange={handleOpenChange}>
        <DialogContent className="sm:max-w-[950px] h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>{description}</DialogDescription>
          </DialogHeader>
          <TransportationForm
            ref={formRef}
            onSuccess={onClose}
            editData={
              editItem
                ? isCopy
                  ? { ...editItem, id: undefined }
                  : editItem
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
