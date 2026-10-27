type RefuelingOrderMutationOptions = {
  orderId: string;
  request: (
    method: string,
    url: string,
    data: unknown,
  ) => Promise<{ json: () => Promise<unknown> }>;
  invalidateOrderQueries: () => void;
  notifySuccess: () => void;
  showError: (message: string, module: string) => void;
  onSuccess?: () => void;
};

export function createRefuelingOrderMutationOptions({
  orderId,
  request,
  invalidateOrderQueries,
  notifySuccess,
  showError,
  onSuccess,
}: RefuelingOrderMutationOptions) {
  return {
    mutationFn: async (deals: object[]) => {
      const response = await request("PUT", `/api/refueling/order/${orderId}`, {
        deals,
      });
      return response.json();
    },
    onSuccess: () => {
      invalidateOrderQueries();
      notifySuccess();
      onSuccess?.();
    },
    onError: (error: Error) => {
      showError(
        error.message?.trim() ||
          "Не удалось сохранить заказ заправки. Проверьте данные и попробуйте снова.",
        "refueling",
      );
    },
  };
}
