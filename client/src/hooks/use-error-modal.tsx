import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertTriangle, X, Lightbulb } from "lucide-react";

interface ErrorInfo {
  title: string;
  description: string;
  hint?: string;
}

function getErrorInfo(message: string, module?: string): ErrorInfo {
  const lower = message.toLowerCase();

  if (
    lower.includes("цена закупки") ||
    lower.includes("цена не найдена") ||
    lower.includes("purchase price") ||
    lower.includes("нет цены") ||
    (lower.includes("цена") && lower.includes("поставщик"))
  ) {
    return {
      title: "Отсутствует цена закупки",
      description: message,
      hint: "Добавьте цену поставщику через раздел «Цены» или создайте цену прямо из формы сделки. Проверьте, что даты действия цены охватывают дату сделки.",
    };
  }

  if (
    lower.includes("цена продажи") ||
    lower.includes("sale price") ||
    (lower.includes("цена") && lower.includes("покупател"))
  ) {
    return {
      title: "Отсутствует цена продажи",
      description: message,
      hint: "Добавьте цену покупателю через раздел «Цены» или создайте цену прямо из формы сделки.",
    };
  }

  if (
    lower.includes("перевозчик") ||
    lower.includes("carrier")
  ) {
    return {
      title: "Перевозчик не указан",
      description: message,
      hint: "Выберите перевозчика из списка. Если подходящего нет — добавьте нового через раздел «Логистика → Перевозчики».",
    };
  }

  if (
    lower.includes("недостаточно") ||
    lower.includes("остаток") ||
    lower.includes("баланс") ||
    lower.includes("balance")
  ) {
    return {
      title: "Недостаточно остатков",
      description: message,
      hint: "Проверьте баланс склада перед созданием операции. Убедитесь, что объём в заявке не превышает доступный остаток.",
    };
  }

  if (
    lower.includes("дата") ||
    lower.includes("пересечени") ||
    lower.includes("overlap") ||
    lower.includes("period")
  ) {
    return {
      title: "Ошибка периода дат",
      description: message,
      hint: "Проверьте даты действия цены. Два периода для одного контрагента и базиса не должны пересекаться.",
    };
  }

  if (
    lower.includes("поставщик") ||
    lower.includes("supplier")
  ) {
    return {
      title: "Ошибка поставщика",
      description: message,
      hint: "Выберите поставщика из списка. Убедитесь, что он активен и привязан к нужному базису.",
    };
  }

  if (
    lower.includes("покупател") ||
    lower.includes("buyer") ||
    lower.includes("customer")
  ) {
    return {
      title: "Ошибка покупателя",
      description: message,
      hint: "Выберите покупателя из списка. Убедитесь, что он активен.",
    };
  }

  if (lower.includes("объём") || lower.includes("объем") || lower.includes("volume") || lower.includes("количест")) {
    return {
      title: "Ошибка объёма",
      description: message,
      hint: "Проверьте введённое количество. Значение должно быть положительным числом.",
    };
  }

  if (lower.includes("контракт") || lower.includes("contract")) {
    return {
      title: "Ошибка контракта",
      description: message,
      hint: "Проверьте объём по контракту. Возможно, лимит исчерпан или контракт не активен.",
    };
  }

  const moduleHints: Record<string, string> = {
    movement: "Проверьте все обязательные поля: тип перемещения, склад-источник, склад-назначения, объём и перевозчика.",
    opt: "Проверьте все обязательные поля: поставщик, покупатель, объём, цена закупки и цена продажи.",
    refueling: "Проверьте все обязательные поля: борт, поставщик, покупатель, объём, цена закупки и цена продажи.",
    transportation: "Проверьте все обязательные поля: поставщик, покупатель, перевозчик, объём и цены.",
    price: "Проверьте данные цены: контрагент, базис, даты действия. Убедитесь, что периоды не пересекаются.",
  };

  return {
    title: "Ошибка при сохранении",
    description: message,
    hint: module ? moduleHints[module] : undefined,
  };
}

export function useErrorModal() {
  const [errorInfo, setErrorInfo] = useState<ErrorInfo | null>(null);

  const showError = (error: Error | string, module?: string) => {
    const message = typeof error === "string" ? error : error.message;
    setErrorInfo(getErrorInfo(message, module));
  };

  const closeError = () => setErrorInfo(null);

  function ErrorModalComponent() {
    if (!errorInfo) return null;

    return (
      <Dialog open={!!errorInfo} onOpenChange={(open) => !open && closeError()}>
        <DialogContent
          className="max-w-md"
          onPointerDownOutside={(e) => e.preventDefault()}
          onEscapeKeyDown={closeError}
        >
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5 shrink-0" />
              {errorInfo.title}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <p className="text-sm text-muted-foreground leading-relaxed">
              {errorInfo.description}
            </p>

            {errorInfo.hint && (
              <div className="flex gap-2 rounded-md bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 p-3">
                <Lightbulb className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                <p className="text-sm text-amber-800 dark:text-amber-300 leading-relaxed">
                  {errorInfo.hint}
                </p>
              </div>
            )}

            <div className="flex justify-end">
              <Button onClick={closeError} variant="outline">
                <X className="h-4 w-4 mr-2" />
                Закрыть
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return { showError, ErrorModalComponent, closeError };
}
