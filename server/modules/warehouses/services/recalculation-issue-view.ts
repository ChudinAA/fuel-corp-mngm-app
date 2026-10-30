import { RECALCULATION_STATUS } from "@shared/constants";

export const MAX_AUTOMATIC_RECALCULATION_ATTEMPTS = 3;

export type RecalculationIssueStatus =
  | typeof RECALCULATION_STATUS.PENDING
  | typeof RECALCULATION_STATUS.PROCESSING
  | typeof RECALCULATION_STATUS.FAILED;

interface RecalculationIssueRecord {
  id: string;
  recordId: string;
  recordName: string;
  recordType: "warehouse" | "equipment";
  productType: string;
  afterDate: string;
  status: string;
  attempts: number | null;
}

export function toRecalculationIssueView(record: RecalculationIssueRecord) {
  const status = record.status as RecalculationIssueStatus;

  let safeMessage: string;
  let nextAction: string;
  if (status === RECALCULATION_STATUS.FAILED) {
    safeMessage = "Автоматический пересчёт не удался после нескольких попыток.";
    nextAction =
      "Повторы исчерпаны. Обратитесь к администратору для проверки и повторного запуска пересчёта.";
  } else if (status === RECALCULATION_STATUS.PROCESSING) {
    safeMessage = "Повторный пересчёт запущен после ошибки.";
    nextAction = "Система выполняет пересчёт. Дождитесь его завершения.";
  } else {
    safeMessage = "Предыдущая попытка пересчёта завершилась с ошибкой.";
    nextAction = "Система автоматически поставила повторную попытку в очередь.";
  }

  return {
    id: record.id,
    recordId: record.recordId,
    recordName: record.recordName,
    recordType: record.recordType,
    productType: record.productType,
    afterDate: record.afterDate,
    status,
    attempts: record.attempts ?? 0,
    maxAttempts: MAX_AUTOMATIC_RECALCULATION_ATTEMPTS,
    safeMessage,
    nextAction,
  };
}
