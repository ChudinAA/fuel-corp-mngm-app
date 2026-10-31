import { useState } from "react";
import { useLocation } from "wouter";
import { useInfiniteQuery, useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { AlertTriangle, Check, Clipboard, KeyRound, Loader2, RefreshCw, ShieldCheck, Trash2 } from "lucide-react";

type IntegrationStatus = {
  activeKey: { id: string; keyPrefix: string; createdAt: string } | null;
  pendingReviewCount: number;
};

const typeNames: Record<string, string> = {
  supplier: "Поставщик",
  customer: "Покупатель",
  carrier: "Перевозчик",
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

export default function Integration1CPage() {
  const [, setLocation] = useLocation();
  const { isAdmin } = useAuth();
  const { toast } = useToast();
  const [newKey, setNewKey] = useState<string | null>(null);
  const { data: status, isLoading } = useQuery<IntegrationStatus>({
    queryKey: ["/api/admin/integrations/1c/status"],
    queryFn: async () => checkResponse(await apiRequest("GET", "/api/admin/integrations/1c/status")),
    enabled: isAdmin,
  });
  const { data: pendingItems = [] } = useQuery<any[]>({
    queryKey: ["/api/admin/integrations/1c/pending"],
    queryFn: async () => checkResponse(await apiRequest("GET", "/api/admin/integrations/1c/pending")),
    enabled: isAdmin,
  });
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
  const reviewMutation = useMutation({
    mutationFn: async ({ id, action }: { id: number; action: "approve" | "reject" }) =>
      checkResponse(await apiRequest("POST", `/api/admin/integrations/1c/changes/${id}/review`, { action })),
    onSuccess: (_data, variables) => {
      refresh();
      queryClient.invalidateQueries({ queryKey: ["/api/suppliers"] });
      queryClient.invalidateQueries({ queryKey: ["/api/customers"] });
      queryClient.invalidateQueries({ queryKey: ["/api/logistics/carriers"] });
      toast({ title: variables.action === "approve" ? "Запись подтверждена" : "Запись отклонена" });
    },
    onError: (error: Error) => toast({ title: "Не удалось обработать запись", description: error.message, variant: "destructive" }),
  });

  const copyKey = async () => {
    if (!newKey) return;
    await navigator.clipboard.writeText(newKey);
    toast({ title: "Ключ скопирован" });
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Интеграция с 1С</h1>
        <p className="text-muted-foreground">API-ключ, проверка новых контрагентов и журнал обмена.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><KeyRound className="h-5 w-5" />API-ключ</CardTitle>
          <CardDescription>
            Ключ показывается один раз, в базе хранится только его хеш. После его создания обычные пользователи смогут редактировать контрагентов, но не менять поля, полученные из 1С, и не создавать или удалять записи. Администраторы сохраняют полный доступ.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {status.activeKey ? (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border p-3">
              <div>
                <div className="flex items-center gap-2"><Badge>Активен</Badge><code className="text-sm">{status.activeKey.keyPrefix}…</code></div>
                <p className="mt-1 text-sm text-muted-foreground">Создан: {new Date(status.activeKey.createdAt).toLocaleString("ru-RU")}</p>
              </div>
              <Button variant="outline" onClick={() => keyMutation.mutate()} disabled={keyMutation.isPending}>
                {keyMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                Перевыпустить
              </Button>
            </div>
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border p-3">
              <p className="text-sm text-muted-foreground">Активного API-ключа нет.</p>
              <Button onClick={() => keyMutation.mutate()} disabled={keyMutation.isPending}>
                {keyMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <KeyRound className="mr-2 h-4 w-4" />}
                Создать ключ
              </Button>
            </div>
          )}

          {status.activeKey && (
            <Button variant="ghost" size="sm" className="text-destructive" onClick={() => {
              if (window.confirm("Отозвать активный ключ? Запросы 1С перестанут проходить авторизацию.")) revokeMutation.mutate();
            }} disabled={revokeMutation.isPending}>
              <Trash2 className="mr-2 h-4 w-4" />Отозвать ключ
            </Button>
          )}

          {newKey && (
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Скопируйте секрет сейчас</AlertTitle>
              <AlertDescription className="space-y-3">
                <p>После закрытия этой страницы ключ больше нельзя будет просмотреть. Передайте его ответственному за настройку 1С по защищённому каналу.</p>
                <div className="flex flex-wrap gap-2">
                  <code className="min-w-0 flex-1 break-all rounded bg-muted p-2 text-xs">{newKey}</code>
                  <Button variant="outline" size="sm" onClick={copyKey}><Clipboard className="mr-2 h-4 w-4" />Копировать</Button>
                  <Button variant="ghost" size="sm" onClick={() => setNewKey(null)}>Скрыть</Button>
                </div>
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Новые записи на проверку <Badge variant="secondary">{status.pendingReviewCount}</Badge></CardTitle>
          <CardDescription>Новые сущности из 1С видны в справочниках с отметкой до подтверждения. При необходимости отредактируйте дополнительные поля в справочнике, затем подтвердите запись.</CardDescription>
        </CardHeader>
        <CardContent>
          {pendingItems.length === 0 ? (
            <p className="text-sm text-muted-foreground">Новых записей нет.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader><TableRow>
                  <TableHead>Тип</TableHead><TableHead>Название</TableHead><TableHead>Полное название</TableHead><TableHead>ИНН</TableHead><TableHead>Поступила</TableHead><TableHead className="text-right">Действия</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {pendingItems.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>{typeNames[item.entityType] ?? item.entityType}</TableCell>
                      <TableCell className="font-medium">{item.currentEntity?.name ?? item.incomingData?.name ?? "—"}</TableCell>
                      <TableCell>{item.currentEntity?.fullName ?? item.incomingData?.full_name ?? "—"}</TableCell>
                      <TableCell className="font-mono">{item.currentEntity?.inn ?? item.incomingData?.inn ?? "—"}</TableCell>
                      <TableCell className="whitespace-nowrap">{new Date(item.createdAt).toLocaleString("ru-RU")}</TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-2">
                          <Button size="sm" onClick={() => reviewMutation.mutate({ id: item.id, action: "approve" })} disabled={reviewMutation.isPending}>
                            <Check className="mr-1 h-4 w-4" />Подтвердить
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => setLocation(
                            item.entityType === "carrier" ? "/directories?tab=carriers" :
                              `/counterparties?tab=${item.entityType === "customer" ? "customers" : "suppliers"}`,
                          )}>
                            Открыть справочник
                          </Button>
                          <Button size="sm" variant="outline" className="text-destructive" onClick={() => {
                            if (window.confirm("Отклонить запись? Она будет мягко удалена из справочника.")) reviewMutation.mutate({ id: item.id, action: "reject" });
                          }} disabled={reviewMutation.isPending}>Отклонить</Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Журнал запросов</CardTitle>
          <CardDescription>По 50 запросов на страницу. Тело запроса и API-ключ не сохраняются; доступны метаданные, ответ и результаты синхронизации.</CardDescription>
        </CardHeader>
        <CardContent>
          {requestLogsQuery.isLoading ? <div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Загрузка журнала…</div> :
          requestLogs.length === 0 ? <p className="text-sm text-muted-foreground">Запросов пока не было.</p> : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader><TableRow>
                  <TableHead>Время</TableHead><TableHead>Метод и путь</TableHead><TableHead>HTTP</TableHead><TableHead>Источник</TableHead><TableHead>Клиент</TableHead><TableHead>Трафик</TableHead><TableHead>Элементы</TableHead><TableHead>Время</TableHead><TableHead>Ошибка / ответ</TableHead><TableHead>Request ID</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {requestLogs.map((row: any) => (
                    <TableRow key={row.id}>
                      <TableCell className="whitespace-nowrap">{new Date(row.createdAt).toLocaleString("ru-RU")}</TableCell>
                      <TableCell className="min-w-64"><code>{row.method} {row.path}</code></TableCell>
                      <TableCell><Badge variant={row.statusCode >= 400 ? "destructive" : "outline"}>{row.statusCode}</Badge></TableCell>
                      <TableCell className="font-mono text-xs">{row.clientIp ?? "—"}</TableCell>
                      <TableCell className="max-w-48 truncate text-xs" title={row.userAgent ?? ""}>{row.userAgent ?? "—"}</TableCell>
                      <TableCell className="whitespace-nowrap text-xs" title={`${row.requestContentType ?? "тип запроса неизвестен"} → ${row.responseContentType ?? "тип ответа неизвестен"}`}>
                        {row.requestContentLength ?? "—"} Б / {row.responseContentLength ?? "—"} Б
                      </TableCell>
                      <TableCell>{row.itemCount ?? "—"}</TableCell>
                      <TableCell>{row.durationMs} мс</TableCell>
                      <TableCell className="min-w-48">
                        {row.errorCode ? <Badge variant="destructive">{row.errorCode}</Badge> : "—"}
                        {row.errorMessage && <p className="mt-1 max-w-56 text-xs text-muted-foreground">{row.errorMessage}</p>}
                        {row.responseSummary && <details className="mt-1 max-w-72">
                          <summary className="cursor-pointer text-xs text-primary">Ответ и результаты</summary>
                          <pre className="mt-1 max-h-48 overflow-auto whitespace-pre-wrap rounded bg-muted p-2 text-xs">{JSON.stringify(row.responseSummary, null, 2)}</pre>
                        </details>}
                        {row.apiKeyId && <p className="mt-1 text-xs text-muted-foreground">Ключ ID: {row.apiKeyId.slice(0, 8)}</p>}
                      </TableCell>
                      <TableCell><code className="text-xs">{row.requestId}</code></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {requestLogsQuery.hasNextPage && (
                <div className="flex justify-center pt-4">
                  <Button
                    variant="outline"
                    onClick={() => requestLogsQuery.fetchNextPage()}
                    disabled={requestLogsQuery.isFetchingNextPage}
                    className="w-full max-w-xs gap-2"
                    data-testid="button-load-more-integration-requests"
                  >
                    {requestLogsQuery.isFetchingNextPage ? <><Loader2 className="h-4 w-4 animate-spin" />Загрузка...</> : "Загрузить еще"}
                  </Button>
                </div>
              )}
            </div>
          )}
          {changeLogs.length > 0 && (
            <div className="mt-6">
              <h3 className="mb-2 font-medium">Последние изменения контрагентов</h3>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader><TableRow>
                    <TableHead>Время</TableHead><TableHead>Тип</TableHead><TableHead>Id_1c</TableHead><TableHead>Операция</TableHead><TableHead>Результат</TableHead><TableHead>Код</TableHead><TableHead>Request ID</TableHead><TableHead>Данные</TableHead>
                  </TableRow></TableHeader>
                  <TableBody>
                    {changeLogs.map((row: any) => (
                      <TableRow key={row.id}>
                        <TableCell className="whitespace-nowrap">{new Date(row.createdAt).toLocaleString("ru-RU")}</TableCell>
                        <TableCell>{typeNames[row.entityType] ?? row.entityType}</TableCell>
                        <TableCell><code className="text-xs">{row.external1cId}</code></TableCell>
                        <TableCell>{row.operation}</TableCell>
                        <TableCell>{outcomeNames[row.outcome] ?? row.outcome}</TableCell>
                        <TableCell>{row.errorCode ?? "—"}</TableCell>
                        <TableCell><code className="text-xs">{row.requestId}</code></TableCell>
                        <TableCell>
                          <details className="min-w-40">
                            <summary className="cursor-pointer text-xs text-primary">Показать поля</summary>
                            <pre className="mt-1 max-h-56 max-w-96 overflow-auto whitespace-pre-wrap rounded bg-muted p-2 text-xs">
                              {JSON.stringify({
                                incoming: row.incomingData,
                                old: row.oldData,
                                new: row.newData,
                                error: row.errorMessage,
                              }, null, 2)}
                            </pre>
                          </details>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
