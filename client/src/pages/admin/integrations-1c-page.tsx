import { useMemo, useState } from "react";
import { useInfiniteQuery, useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { AlertTriangle, Check, Clipboard, Eye, KeyRound, Loader2, RefreshCw, ShieldCheck, Trash2, X } from "lucide-react";

type IntegrationStatus = {
  activeKey: { id: string; keyPrefix: string; createdAt: string } | null;
  pendingReviewCount: number;
  pendingByType: Record<string, number>;
};

type PendingPage = {
  items: any[];
  pageSize: number;
  hasMore: boolean;
  nextCursor: number | null;
};

const typeNames: Record<string, string> = {
  supplier: "Поставщик",
  customer: "Покупатель",
  carrier: "Перевозчик",
};

const typePluralNames: Record<string, string> = {
  supplier: "Поставщики",
  customer: "Покупатели",
  carrier: "Перевозчики",
};

const outcomeNames: Record<string, string> = {
  created: "Создано",
  updated: "Обновлено",
  deleted: "Удалено",
  skipped: "Пропущено",
  error: "Ошибка",
  conflict: "Конфликт",
};

async function checkResponse(response: Response) {
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.message || "Не удалось выполнить действие");
  }
  return response.json();
}

function formatBytes(value: number | null | undefined) {
  return value == null ? "—" : `${value} Б`;
}

export default function Integration1CPage() {
  const { isAdmin } = useAuth();
  const { toast } = useToast();
  const [newKey, setNewKey] = useState<string | null>(null);
  const [pendingDialogOpen, setPendingDialogOpen] = useState(false);
  const [detailDialog, setDetailDialog] = useState<{ title: string; description: string; data: unknown } | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [excludedIds, setExcludedIds] = useState<Set<number>>(new Set());
  const [allSelected, setAllSelected] = useState(false);

  const { data: status, isLoading } = useQuery<IntegrationStatus>({
    queryKey: ["/api/admin/integrations/1c/status"],
    queryFn: async () => checkResponse(await apiRequest("GET", "/api/admin/integrations/1c/status")),
    enabled: isAdmin,
  });
  const { data: pendingPreview } = useQuery<PendingPage>({
    queryKey: ["/api/admin/integrations/1c/pending", "preview"],
    queryFn: async () => checkResponse(await apiRequest("GET", "/api/admin/integrations/1c/pending?limit=5")),
    enabled: isAdmin,
  });
  const pendingQuery = useInfiniteQuery<PendingPage>({
    queryKey: ["/api/admin/integrations/1c/pending", "pages"],
    initialPageParam: null as number | null,
    queryFn: async ({ pageParam }) => {
      const cursor = pageParam === null ? "" : `&beforeId=${pageParam}`;
      return checkResponse(await apiRequest("GET", `/api/admin/integrations/1c/pending?limit=50${cursor}`));
    },
    getNextPageParam: (lastPage) => lastPage.hasMore ? lastPage.nextCursor : undefined,
    enabled: isAdmin && pendingDialogOpen,
  });
  const visiblePendingItems = useMemo(
    () => pendingQuery.data?.pages.flatMap((page) => page.items) ?? [],
    [pendingQuery.data],
  );
  const requestLogsQuery = useInfiniteQuery({
    queryKey: ["/api/admin/integrations/1c/logs"],
    initialPageParam: null as number | null,
    queryFn: async ({ pageParam }) => {
      const cursor = pageParam === null ? "" : `?beforeId=${pageParam}`;
      return checkResponse(await apiRequest("GET", `/api/admin/integrations/1c/logs${cursor}`));
    },
    getNextPageParam: (lastPage: any) => lastPage.hasMoreRequests ? lastPage.nextCursor : undefined,
    enabled: isAdmin,
  });
  const logPages = requestLogsQuery.data?.pages ?? [];
  const requestLogs = logPages.flatMap((page: any) => page.requests ?? []);
  const changeLogs = logPages[0]?.changes ?? [];
  const selectedCount = allSelected
    ? Math.max(0, (status?.pendingReviewCount ?? 0) - excludedIds.size)
    : selectedIds.size;
  const visibleSelected = visiblePendingItems.filter((item) =>
    allSelected ? !excludedIds.has(item.id) : selectedIds.has(item.id),
  ).length;
  const visibleAllSelected = visiblePendingItems.length > 0 && visibleSelected === visiblePendingItems.length;

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/admin/integrations/1c/status"] });
    queryClient.invalidateQueries({ queryKey: ["/api/admin/integrations/1c/pending"] });
    queryClient.invalidateQueries({ queryKey: ["/api/admin/integrations/1c/logs"] });
    queryClient.invalidateQueries({ queryKey: ["/api/integrations/1c/mode"] });
  };
  const keyMutation = useMutation({
    mutationFn: async () => checkResponse(await apiRequest("POST", "/api/admin/integrations/1c/api-key")),
    onSuccess: (data) => {
      setNewKey(data.apiKey);
      refresh();
      toast({ title: "Ключ выпущен", description: "Скопируйте его сейчас и передайте ответственному за 1С." });
    },
    onError: (error: Error) => toast({ title: "Не удалось выпустить ключ", description: error.message, variant: "destructive" }),
  });
  const revokeMutation = useMutation({
    mutationFn: async () => checkResponse(await apiRequest("DELETE", "/api/admin/integrations/1c/api-key")),
    onSuccess: () => {
      setNewKey(null);
      refresh();
      toast({ title: "Ключ отозван" });
    },
    onError: (error: Error) => toast({ title: "Не удалось отозвать ключ", description: error.message, variant: "destructive" }),
  });
  const bulkReviewMutation = useMutation({
    mutationFn: async (action: "approve" | "reject") => {
      const body = allSelected
        ? { all: true, excludeIds: [...excludedIds], action }
        : { ids: [...selectedIds], action };
      return checkResponse(await apiRequest("POST", "/api/admin/integrations/1c/changes/review-bulk", body));
    },
    onSuccess: (data, action) => {
      setSelectedIds(new Set());
      setExcludedIds(new Set());
      setAllSelected(false);
      refresh();
      queryClient.invalidateQueries({ queryKey: ["/api/suppliers"] });
      queryClient.invalidateQueries({ queryKey: ["/api/customers"] });
      queryClient.invalidateQueries({ queryKey: ["/api/logistics/carriers"] });
      toast({
        title: action === "approve" ? "Записи подтверждены" : "Записи отклонены",
        description: `Обработано: ${data.reviewed}`,
      });
    },
    onError: (error: Error) => toast({ title: "Не удалось обработать записи", description: error.message, variant: "destructive" }),
  });

  const copyKey = async () => {
    if (!newKey) return;
    await navigator.clipboard.writeText(newKey);
    toast({ title: "Ключ скопирован" });
  };

  const changeSelection = (id: number, checked: boolean) => {
    if (allSelected) {
      setExcludedIds((current) => {
        const next = new Set(current);
        if (checked) next.delete(id);
        else next.add(id);
        return next;
      });
      return;
    }
    setSelectedIds((current) => {
      const next = new Set(current);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const changePageSelection = (checked: boolean) => {
    if (allSelected) {
      setExcludedIds((current) => {
        const next = new Set(current);
        for (const item of visiblePendingItems) {
          if (checked) next.delete(item.id);
          else next.add(item.id);
        }
        return next;
      });
      return;
    }
    setSelectedIds((current) => {
      const next = new Set(current);
      for (const item of visiblePendingItems) {
        if (checked) next.add(item.id);
        else next.delete(item.id);
      }
      return next;
    });
  };

  const toggleSelectAllPending = () => {
    if (allSelected) {
      setAllSelected(false);
      setExcludedIds(new Set());
      setSelectedIds(new Set());
    } else {
      setAllSelected(true);
      setSelectedIds(new Set());
      setExcludedIds(new Set());
    }
  };

  const reviewSelected = (action: "approve" | "reject") => {
    if (!selectedCount) return;
    if (action === "reject" && !window.confirm(`Отклонить ${selectedCount} записей? Они будут мягко удалены из справочников.`)) return;
    bulkReviewMutation.mutate(action);
  };

  const onPendingDialogChange = (open: boolean) => {
    setPendingDialogOpen(open);
    if (!open) {
      setSelectedIds(new Set());
      setExcludedIds(new Set());
      setAllSelected(false);
    } else {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/integrations/1c/pending", "pages"] });
    }
  };

  if (!isAdmin) {
    return (
      <Alert variant="destructive">
        <ShieldCheck className="h-4 w-4" />
        <AlertTitle>Доступ только для администратора</AlertTitle>
        <AlertDescription>Управлять интеграцией 1С может администратор или генеральный директор.</AlertDescription>
      </Alert>
    );
  }

  if (isLoading || !status) {
    return <div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Загрузка настроек интеграции…</div>;
  }

  const previews = pendingPreview?.items ?? [];

  return (
    <div className="min-w-0 max-w-full space-y-4 overflow-x-hidden">
      <header className="min-w-0">
        <h1 className="text-2xl font-semibold">Интеграция с 1С</h1>
        <p className="text-sm text-muted-foreground">Ключ API, проверка новых контрагентов и история обмена.</p>
      </header>

      <Card className="min-w-0">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg"><KeyRound className="h-5 w-5" />API-ключ</CardTitle>
          <CardDescription className="max-w-4xl text-sm">
            Ключ показывается один раз, в базе хранится только его хеш. При активном ключе обычные пользователи не могут менять мастер-поля, создавать или удалять записи; администраторы сохраняют полный доступ.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex min-w-0 flex-wrap items-center justify-between gap-3 rounded-md border p-3">
            {status.activeKey ? (
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2"><Badge>Активен</Badge><code className="text-sm">{status.activeKey.keyPrefix}…</code></div>
                <p className="mt-1 text-xs text-muted-foreground">Создан: {new Date(status.activeKey.createdAt).toLocaleString("ru-RU")}</p>
              </div>
            ) : <p className="text-sm text-muted-foreground">Активного API-ключа нет.</p>}
            <div className="flex flex-wrap gap-2">
              <Button size="sm" onClick={() => keyMutation.mutate()} disabled={keyMutation.isPending}>
                {keyMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                {status.activeKey ? "Перевыпустить" : "Создать ключ"}
              </Button>
              {status.activeKey && (
                <Button size="sm" variant="outline" className="text-destructive" onClick={() => {
                  if (window.confirm("Отозвать активный ключ? Запросы 1С перестанут проходить авторизацию.")) revokeMutation.mutate();
                }} disabled={revokeMutation.isPending}>
                  <Trash2 className="mr-2 h-4 w-4" />Отозвать
                </Button>
              )}
            </div>
          </div>
          {newKey && (
            <Alert className="min-w-0">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Скопируйте секрет сейчас</AlertTitle>
              <AlertDescription className="space-y-3">
                <p>После закрытия этой страницы ключ больше нельзя будет просмотреть.</p>
                <div className="flex min-w-0 flex-wrap gap-2">
                  <code className="min-w-0 flex-1 break-all rounded bg-muted p-2 text-xs">{newKey}</code>
                  <Button variant="outline" size="sm" onClick={copyKey}><Clipboard className="mr-2 h-4 w-4" />Копировать</Button>
                  <Button variant="ghost" size="sm" onClick={() => setNewKey(null)}>Скрыть</Button>
                </div>
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      <Card className="min-w-0">
        <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3 pb-3">
          <div className="min-w-0">
            <CardTitle className="flex flex-wrap items-center gap-2 text-lg">
              Новые записи на проверку
              <Badge variant={status.pendingReviewCount ? "secondary" : "outline"}>{status.pendingReviewCount}</Badge>
            </CardTitle>
            <CardDescription className="mt-1 text-sm">
              Проверьте новые записи и при необходимости заполните рабочие поля перед подтверждением.
            </CardDescription>
          </div>
          <Button size="sm" variant="outline" disabled={!status.pendingReviewCount} onClick={() => onPendingDialogChange(true)}>
            <Eye className="mr-2 h-4 w-4" />Открыть список
          </Button>
        </CardHeader>
        <CardContent className="min-w-0">
          {status.pendingReviewCount === 0 ? (
            <p className="text-sm text-muted-foreground">Новых записей на проверку нет.</p>
          ) : (
            <div className="space-y-3">
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                {(["supplier", "customer", "carrier"] as const).map((type) => (
                  <div key={type} className="flex min-w-0 items-center justify-between rounded-md bg-muted/50 px-3 py-2">
                    <span className="truncate text-sm">{typePluralNames[type]}</span>
                    <Badge variant="outline">{status.pendingByType?.[type] ?? 0}</Badge>
                  </div>
                ))}
              </div>
              {previews.length > 0 && (
                <div className="flex min-w-0 flex-wrap gap-2">
                  {previews.slice(0, 3).map((item) => (
                    <span key={item.id} className="max-w-full truncate rounded-full border px-3 py-1 text-xs" title={item.currentEntity?.name ?? item.incomingData?.name ?? ""}>
                      {item.currentEntity?.name ?? item.incomingData?.name ?? "Новая запись"}
                    </span>
                  ))}
                  {status.pendingReviewCount > previews.length && (
                    <span className="self-center text-xs text-muted-foreground">и ещё {status.pendingReviewCount - previews.length}</span>
                  )}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="min-w-0">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Журнал запросов</CardTitle>
          <CardDescription className="text-sm">
            {requestLogs.length} запросов загружено · страницы по 50 · секреты и тела запросов не сохраняются.
          </CardDescription>
        </CardHeader>
        <CardContent className="min-w-0 space-y-3">
          {requestLogsQuery.isLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Загрузка журнала…</div>
          ) : requestLogs.length === 0 ? (
            <p className="text-sm text-muted-foreground">Запросов пока не было.</p>
          ) : requestLogs.map((row: any) => (
            <article key={row.id} className="min-w-0 rounded-lg border p-3">
              <div className="flex min-w-0 flex-wrap items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline">{row.method}</Badge>
                    <Badge variant={row.statusCode >= 400 ? "destructive" : "secondary"}>{row.statusCode}</Badge>
                    <code className="min-w-0 break-all text-xs sm:text-sm">{row.path}</code>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{new Date(row.createdAt).toLocaleString("ru-RU")}</p>
                </div>
                <div className="flex shrink-0 items-center gap-2 text-xs text-muted-foreground">
                  <span>{row.durationMs} мс</span>
                  <span>·</span>
                  <span>{row.itemCount ?? "—"} эл.</span>
                </div>
              </div>
              <div className="mt-3 grid min-w-0 grid-cols-2 gap-x-3 gap-y-2 text-xs sm:grid-cols-3">
                <div className="min-w-0"><span className="text-muted-foreground">IP: </span><span className="break-all font-mono">{row.clientIp ?? "—"}</span></div>
                <div className="min-w-0"><span className="text-muted-foreground">Трафик: </span>{formatBytes(row.requestContentLength)} → {formatBytes(row.responseContentLength)}</div>
                <div className="min-w-0"><span className="text-muted-foreground">API-ключ: </span>{row.apiKeyId ? row.apiKeyId.slice(0, 8) : "—"}</div>
                <div className="col-span-2 min-w-0 sm:col-span-3">
                  <span className="text-muted-foreground">Клиент: </span>
                  <span className="break-words" title={row.userAgent ?? ""}>{row.userAgent ?? "—"}</span>
                </div>
                <div className="col-span-2 min-w-0 sm:col-span-3">
                  <span className="text-muted-foreground">Request ID: </span>
                  <code className="break-all">{row.requestId}</code>
                </div>
              </div>
              {row.errorCode && (
                <div className="mt-2 flex min-w-0 flex-wrap items-center gap-2 text-sm">
                  <Badge variant="destructive">{row.errorCode}</Badge>
                  {row.errorMessage && <span className="break-words text-xs text-muted-foreground">{row.errorMessage}</span>}
                </div>
              )}
              {row.responseSummary && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="mt-2 h-auto p-0 text-xs hover:bg-transparent hover:underline"
                  onClick={() => setDetailDialog({ title: "Ответ и результаты", description: `Запрос ${row.requestId}`, data: row.responseSummary })}
                >
                  <Eye className="mr-1 h-3.5 w-3.5" />Ответ и результаты
                </Button>
              )}
            </article>
          ))}
          {requestLogsQuery.hasNextPage && (
            <Button
              variant="outline"
              onClick={() => requestLogsQuery.fetchNextPage()}
              disabled={requestLogsQuery.isFetchingNextPage}
              className="w-full gap-2"
              data-testid="button-load-more-integration-requests"
            >
              {requestLogsQuery.isFetchingNextPage ? <><Loader2 className="h-4 w-4 animate-spin" />Загрузка…</> : "Загрузить ещё 50"}
            </Button>
          )}
        </CardContent>
      </Card>

      <Card className="min-w-0">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Последние изменения контрагентов</CardTitle>
          <CardDescription className="text-sm">До 50 последних результатов обработки с переходом к деталям в отдельном окне.</CardDescription>
        </CardHeader>
        <CardContent className="min-w-0 space-y-2">
          {changeLogs.length === 0 ? <p className="text-sm text-muted-foreground">Изменений пока нет.</p> : changeLogs.map((row: any) => (
            <article key={row.id} className="flex min-w-0 flex-wrap items-center justify-between gap-3 rounded-md border px-3 py-2.5">
              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex min-w-0 flex-wrap items-center gap-2">
                  <Badge variant="outline">{typeNames[row.entityType] ?? row.entityType}</Badge>
                  <Badge variant={row.outcome === "error" || row.outcome === "conflict" ? "destructive" : "secondary"}>
                    {outcomeNames[row.outcome] ?? row.outcome}
                  </Badge>
                  <span className="text-xs text-muted-foreground">{row.operation}</span>
                  {row.errorCode && <code className="text-xs text-destructive">{row.errorCode}</code>}
                </div>
                <p className="break-all text-xs text-muted-foreground">
                  {new Date(row.createdAt).toLocaleString("ru-RU")} · Id_1c: {row.external1cId}
                </p>
                <p className="break-all font-mono text-[11px] text-muted-foreground">Request ID: {row.requestId}</p>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="shrink-0"
                onClick={() => setDetailDialog({
                  title: "Поля изменения",
                  description: `${typeNames[row.entityType] ?? row.entityType} · ${row.external1cId}`,
                  data: { incoming: row.incomingData, old: row.oldData, new: row.newData, error: row.errorMessage },
                })}
              >
                <Eye className="mr-2 h-4 w-4" />Поля
              </Button>
            </article>
          ))}
        </CardContent>
      </Card>

      <Dialog open={pendingDialogOpen} onOpenChange={onPendingDialogChange}>
        <DialogContent className="flex max-h-[90vh] w-[calc(100vw-1rem)] max-w-4xl flex-col gap-0 overflow-hidden p-0">
          <DialogHeader className="shrink-0 border-b px-5 py-4 pr-12 text-left">
            <DialogTitle>Новые записи на проверку</DialogTitle>
            <DialogDescription>
              {status.pendingReviewCount} ожидают решения. Выберите строки на странице или отметьте сразу все записи.
            </DialogDescription>
          </DialogHeader>
          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-5 py-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <Checkbox
                  checked={visibleAllSelected}
                  onCheckedChange={(checked) => changePageSelection(checked === true)}
                  aria-label="Выбрать все записи на этой странице"
                />
                Выбрать страницу ({visiblePendingItems.length})
              </label>
              <Button type="button" variant="ghost" size="sm" className="h-auto p-0 hover:bg-transparent hover:underline" onClick={toggleSelectAllPending}>
                {allSelected ? "Снять выбор со всех записей" : `Выбрать все ${status.pendingReviewCount}`}
              </Button>
            </div>
            {allSelected && (
              <Alert className="py-2">
                <AlertDescription className="text-xs">
                  Выбраны все ожидающие записи{excludedIds.size ? `, кроме ${excludedIds.size}` : ""}. Снимите галочки с отдельных строк, чтобы исключить их.
                </AlertDescription>
              </Alert>
            )}
            {pendingQuery.isLoading ? (
              <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Загрузка записей…</div>
            ) : visiblePendingItems.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">Новых записей на проверку нет.</p>
            ) : (
              <div className="space-y-2">
                {visiblePendingItems.map((item) => {
                  const name = item.currentEntity?.name ?? item.incomingData?.name ?? "Новая запись";
                  const checked = allSelected ? !excludedIds.has(item.id) : selectedIds.has(item.id);
                  return (
                    <label key={item.id} className="flex min-w-0 cursor-pointer items-start gap-3 rounded-md border p-3 hover:bg-muted/40">
                      <Checkbox className="mt-0.5" checked={checked} onCheckedChange={(value) => changeSelection(item.id, value === true)} />
                      <div className="min-w-0 flex-1">
                        <div className="flex min-w-0 flex-wrap items-center gap-2">
                          <span className="break-words font-medium">{name}</span>
                          <Badge variant="outline">{typeNames[item.entityType] ?? item.entityType}</Badge>
                        </div>
                        <p className="mt-1 break-words text-xs text-muted-foreground">
                          {item.currentEntity?.fullName ?? item.incomingData?.full_name ?? "Полное название не указано"}
                        </p>
                        <div className="mt-1 flex min-w-0 flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                          <span>ИНН: <span className="font-mono">{item.currentEntity?.inn ?? item.incomingData?.inn ?? "—"}</span></span>
                          <span>{new Date(item.createdAt).toLocaleString("ru-RU")}</span>
                        </div>
                      </div>
                    </label>
                  );
                })}
              </div>
            )}
            {pendingQuery.hasNextPage && (
              <Button variant="outline" className="w-full" onClick={() => pendingQuery.fetchNextPage()} disabled={pendingQuery.isFetchingNextPage}>
                {pendingQuery.isFetchingNextPage ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Загрузка…</> : "Загрузить ещё 50"}
              </Button>
            )}
          </div>
          <Separator />
          <DialogFooter className="shrink-0 flex-row flex-wrap justify-between gap-2 px-5 py-3">
            <span className="self-center text-sm text-muted-foreground">Выбрано: {selectedCount}</span>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={() => reviewSelected("reject")} disabled={!selectedCount || bulkReviewMutation.isPending}>
                {bulkReviewMutation.isPending && bulkReviewMutation.variables === "reject" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <X className="mr-2 h-4 w-4" />}
                Отклонить
              </Button>
              <Button size="sm" onClick={() => reviewSelected("approve")} disabled={!selectedCount || bulkReviewMutation.isPending}>
                {bulkReviewMutation.isPending && bulkReviewMutation.variables === "approve" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}
                Подтвердить
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(detailDialog)} onOpenChange={(open) => !open && setDetailDialog(null)}>
        <DialogContent className="flex max-h-[85vh] w-[calc(100vw-1rem)] max-w-3xl flex-col overflow-hidden">
          <DialogHeader className="text-left">
            <DialogTitle>{detailDialog?.title}</DialogTitle>
            <DialogDescription className="break-all">{detailDialog?.description}</DialogDescription>
          </DialogHeader>
          <pre className="min-h-0 overflow-auto whitespace-pre-wrap break-all rounded-md bg-muted p-3 text-xs leading-relaxed">
            {JSON.stringify(detailDialog?.data ?? {}, null, 2)}
          </pre>
        </DialogContent>
      </Dialog>
    </div>
  );
}
