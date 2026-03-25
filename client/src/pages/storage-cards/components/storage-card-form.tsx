import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useErrorModal } from "@/hooks/use-error-modal";
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
import { Combobox } from "@/components/ui/combobox";
import { useState } from "react";

interface StorageCard {
  id: string;
  name: string;
  cardType?: string | null;
  currency: string | null;
  currencySymbol: string | null;
  currencyId: string | null;
  supplierId?: string | null;
  buyerId?: string | null;
  currentBalance: string | null;
  averageCost: string | null;
  notes: string | null;
  isActive: boolean | null;
}

interface Supplier {
  id: string;
  name: string;
  isForeign?: boolean;
  isIntermediary?: boolean;
}

interface Customer {
  id: string;
  name: string;
  isForeign?: boolean;
  isIntermediary?: boolean;
}

const storageCardFormSchema = z.object({
  name: z.string().min(1, "Название обязательно"),
  supplierId: z.string().optional(),
  buyerId: z.string().optional(),
  notes: z.string().optional(),
});

type StorageCardFormData = z.infer<typeof storageCardFormSchema>;

export function StorageCardForm({
  editCard,
  cardType = "supplier",
  onSuccess,
  onCancel,
}: {
  editCard?: StorageCard | null;
  cardType?: "supplier" | "buyer";
  onSuccess: () => void;
  onCancel: () => void;
}) {
  const { toast } = useToast();
  const { showError, ErrorModalComponent } = useErrorModal();
  const isBuyer = cardType === "buyer";
  const [confirmRelinkCard, setConfirmRelinkCard] = useState<any>(null);
  const [pendingSubmitData, setPendingSubmitData] = useState<StorageCardFormData | null>(null);

  const form = useForm<StorageCardFormData>({
    resolver: zodResolver(storageCardFormSchema),
    defaultValues: {
      name: editCard?.name || "",
      supplierId: editCard?.supplierId || "",
      buyerId: editCard?.buyerId || "",
      notes: editCard?.notes || "",
    },
  });

  const { data: suppliers = [] } = useQuery<Supplier[]>({
    queryKey: ["/api/suppliers"],
    enabled: !isBuyer,
  });

  const { data: customers = [] } = useQuery<Customer[]>({
    queryKey: ["/api/customers"],
    enabled: isBuyer,
  });

  // Only foreign non-intermediary suppliers
  const foreignSuppliers = (suppliers as Supplier[]).filter(
    (s) => s.isForeign && !s.isIntermediary,
  );
  // Only foreign customers
  const foreignCustomers = (customers as Customer[]).filter((c) => c.isForeign);

  const buildPayload = (data: StorageCardFormData) => ({
    name: data.name,
    notes: data.notes || null,
    cardType,
    currencyId: null,
    currency: "USD",
    currencySymbol: "$",
    supplierId: isBuyer ? null : (data.supplierId || null),
    buyerId: isBuyer ? (data.buyerId || null) : null,
  });

  const createMutation = useMutation({
    mutationFn: async (data: StorageCardFormData) => {
      const response = await apiRequest("POST", "/api/storage-cards", buildPayload(data));
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/storage-cards/advances"] });
      toast({ title: "Карта создана" });
      onSuccess();
    },
    onError: (error: any) => {
      showError(error.message);
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: StorageCardFormData) => {
      const response = await apiRequest(
        "PATCH",
        `/api/storage-cards/${editCard?.id}`,
        buildPayload(data),
      );
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/storage-cards/advances"] });
      toast({ title: "Карта обновлена" });
      onSuccess();
    },
    onError: (error: any) => {
      showError(error.message);
    },
  });

  const unlinkOldCardMutation = useMutation({
    mutationFn: async (cardId: string) => {
      const patch: any = isBuyer ? { buyerId: null } : { supplierId: null };
      const response = await apiRequest("PATCH", `/api/storage-cards/${cardId}`, patch);
      return response.json();
    },
  });

  const checkAndSubmit = async (data: StorageCardFormData) => {
    const counterpartyId = isBuyer ? data.buyerId : data.supplierId;
    if (!counterpartyId) {
      doSubmit(data);
      return;
    }

    const params = new URLSearchParams();
    if (isBuyer) params.set("buyerId", counterpartyId);
    else params.set("supplierId", counterpartyId);
    if (editCard?.id) params.set("excludeId", editCard.id);

    try {
      const resp = await fetch(`/api/storage-cards/by-counterparty?${params}`, {
        credentials: "include",
      });
      const existingCard = await resp.json();

      if (existingCard && existingCard.id) {
        setPendingSubmitData(data);
        setConfirmRelinkCard(existingCard);
      } else {
        doSubmit(data);
      }
    } catch {
      doSubmit(data);
    }
  };

  const doSubmit = (data: StorageCardFormData) => {
    if (editCard) {
      updateMutation.mutate(data);
    } else {
      createMutation.mutate(data);
    }
  };

  const handleRelinkConfirm = async () => {
    if (!confirmRelinkCard || !pendingSubmitData) return;
    await unlinkOldCardMutation.mutateAsync(confirmRelinkCard.id);
    doSubmit(pendingSubmitData);
    setConfirmRelinkCard(null);
    setPendingSubmitData(null);
  };

  return (
    <>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(checkAndSubmit)} className="space-y-4">
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Название карты</FormLabel>
                <FormControl>
                  <Input
                    placeholder="Карта аванса..."
                    data-testid="input-card-name"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {!isBuyer && (
            <FormField
              control={form.control}
              name="supplierId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Поставщик (зарубежный)</FormLabel>
                  <FormControl>
                    <Combobox
                      options={[
                        { value: "", label: "— без привязки —" },
                        ...foreignSuppliers.map((s) => ({
                          value: s.id,
                          label: s.name,
                        })),
                      ]}
                      value={field.value}
                      onValueChange={field.onChange}
                      placeholder="Выберите поставщика..."
                      dataTestId="select-supplier"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          )}

          {isBuyer && (
            <FormField
              control={form.control}
              name="buyerId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Покупатель (зарубежный)</FormLabel>
                  <FormControl>
                    <Combobox
                      options={[
                        { value: "", label: "— без привязки —" },
                        ...foreignCustomers.map((c) => ({
                          value: c.id,
                          label: c.name,
                        })),
                      ]}
                      value={field.value}
                      onValueChange={field.onChange}
                      placeholder="Выберите покупателя..."
                      dataTestId="select-buyer"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          )}

          <FormField
            control={form.control}
            name="notes"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Примечания</FormLabel>
                <FormControl>
                  <Input
                    placeholder="Примечания..."
                    data-testid="input-notes"
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
              data-testid="button-cancel"
            >
              Отмена
            </Button>
            <Button
              type="submit"
              disabled={createMutation.isPending || updateMutation.isPending || unlinkOldCardMutation.isPending}
              data-testid="button-submit"
            >
              {editCard ? "Сохранить" : "Создать"}
            </Button>
          </div>
        </form>
      </Form>

      <AlertDialog
        open={!!confirmRelinkCard}
        onOpenChange={(open) => {
          if (!open) {
            setConfirmRelinkCard(null);
            setPendingSubmitData(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Контрагент уже привязан к другой карте</AlertDialogTitle>
            <AlertDialogDescription>
              У данного контрагента уже есть привязанная карта{" "}
              <strong>"{confirmRelinkCard?.name}"</strong>. Она будет отвязана и
              контрагент привяжется к новой карте. Продолжить?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction onClick={handleRelinkConfirm}>
              Продолжить
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    <ErrorModalComponent />
    </>
  );
}