export interface BudgetMonthRange {
  start: string;
  end: string;
}

/**
 * Returns a half-open UTC calendar-month range for a budget month value.
 * Accepts either YYYY-MM or an ISO timestamp beginning with YYYY-MM.
 */
export function getBudgetMonthRange(value: string): BudgetMonthRange {
  const match = /^(\d{4})-(\d{2})/.exec(value);
  if (!match) {
    throw new TypeError("budgetMonth must begin with YYYY-MM");
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  if (!Number.isInteger(year) || year < 1 || month < 1 || month > 12) {
    throw new RangeError("budgetMonth must contain a valid calendar month");
  }

  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? year + 1 : year;
  const formatDate = (dateYear: number, dateMonth: number) =>
    `${String(dateYear).padStart(4, "0")}-${String(dateMonth).padStart(2, "0")}-01`;

  return {
    start: formatDate(year, month),
    end: formatDate(nextYear, nextMonth),
  };
}
