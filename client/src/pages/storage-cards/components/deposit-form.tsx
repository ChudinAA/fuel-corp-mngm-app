import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { format } from "date-fns";

const depositFormSchema = z.object({
  amount: z.string().min(1, "Сумма обязательна"),
  notes: z.string().optional(),
});

type DepositFormData = z.infer<typeof depositFormSchema>;

export function DepositForm({
  card,
  onSuccess,
  onCancel,
}: {
  card: any;
  onSuccess: () => void;
  onCancel: () => void;
}) {
  const { toast } = useToast();
  const form = useForm<DepositFormData>({
    resolver: zodResolver(depositFormSchema),
    defaultValues: {
      amount: "",
      notes: "",
    },
  });

  const depositMutation = useMutation({
    mutationFn: async (data: DepositFormData) => {
      const response = await apiRequest(
        "POST",
        `/api/storage-cards/${card.id}/transactions`,
        {
          transactionType: "income",
          quantity: parseFloat(data.amount),
          price: 0,
          sum: parseFloat(data.amount),
          notes: data.notes || "Пополнение аванса",
          transactionDate: format(new Date(), "yyyy-MM-dd'T'HH:mm:ss"),
        }
      );
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Аванс успешно внесен" });
      onSuccess();
    },
    onError: (error: any) => {
      toast({
        title: "Ошибка",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit((data) => depositMutation.mutate(data))} className="space-y-4">
        <FormField
          control={form.control}
          name="amount"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Сумма ($)</FormLabel>
              <FormControl>
                <Input
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  data-testid="input-deposit-amount"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="notes"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Комментарий</FormLabel>
              <FormControl>
                <Input
                  placeholder="Комментарий к платежу..."
                  data-testid="input-deposit-notes"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            data-testid="button-cancel-deposit"
          >
            Отмена
          </Button>
          <Button
            type="submit"
            disabled={depositMutation.isPending}
            data-testid="button-confirm-deposit"
          >
            Внести
          </Button>
        </div>
      </form>
    </Form>
  );
}
