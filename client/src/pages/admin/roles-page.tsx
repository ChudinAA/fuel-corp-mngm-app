import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useErrorModal } from "@/hooks/use-error-modal";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { DeleteConfirmDialog } from "@/components/ui/delete-confirm-dialog";
import { useAuth } from "@/hooks/use-auth";
import { EntityActionsMenu, EntityAction } from "@/components/entity-actions-menu";
import { AuditPanel } from "@/components/audit-panel";
import { 
  Plus, 
  Pencil, 
  Trash2, 
  Loader2,
  Search,
  Shield,
  Users,
  Eye,
  Edit3,
  Plus as PlusIcon,
  Trash,
  History
} from "lucide-react";
import type { Role } from "@shared/schema";

const PERMISSION_MODULES = {
  // Операции
  opt: { name: "ОПТ", permissions: ["view", "create", "edit", "delete", "restore"] },
  refueling: { name: "Заправка ВС", permissions: ["view", "create", "edit", "delete", "restore"] },
  movement: { name: "Перемещение", permissions: ["view", "create", "edit", "delete", "restore"] },
  rent: { name: "Аренда СЗ", permissions: ["view", "create", "edit", "delete", "restore"] },
  transportation: { name: "Перевозка", permissions: ["view", "create", "edit", "delete", "restore"] },
  // ЛИК
  "lik-refueling": { name: "Заправка ВС ЛИК", permissions: ["view", "create", "edit", "delete", "restore"] },
  "lik-movement": { name: "Перемещение ЛИК", permissions: ["view", "create", "edit", "delete", "restore"] },
  equipment: { name: "Средства Заправки", permissions: ["view", "create", "edit", "delete", "restore"] },
  // Зарубеж
  abroad: { name: "Заправка ВС Зарубеж", permissions: ["view", "create", "edit", "delete", "restore"] },
  "storage-cards": { name: "Авансы (Зарубеж)", permissions: ["view", "create", "edit", "delete", "restore"] },
  // Биржа
  "exchange-deals": { name: "Сделки Биржи", permissions: ["view", "create", "edit", "delete", "restore"] },
  "exchange-advances": { name: "Авансы Биржи", permissions: ["view", "create", "edit", "delete", "restore"] },
  exchange: { name: "Справочники Биржи", permissions: ["view", "create", "edit", "delete"] },
  // Данные
  warehouses: { name: "Склады", permissions: ["view", "create", "edit", "delete", "restore"] },
  prices: { name: "Цены", permissions: ["view", "create", "edit", "delete", "restore"] },
  counterparties: { name: "Контрагенты", permissions: ["view", "create", "edit", "delete"] },
  delivery: { name: "Доставка", permissions: ["view", "create", "edit", "delete", "restore"] },
  directories: { name: "Справочники", permissions: ["view", "create", "edit", "delete", "restore"] },
  // Финансы
  finance: { name: "Финансы", permissions: ["view", "create", "edit", "delete", "restore"] },
  // Отчеты и Планирование
  reports: { name: "Отчеты", permissions: ["view", "export"] },
  planning: { name: "Планирование", permissions: ["view", "create", "edit", "delete"] },
  // Администрирование
  users: { name: "Пользователи", permissions: ["view", "create", "edit", "delete", "restore"] },
  roles: { name: "Роли", permissions: ["view", "create", "edit", "delete", "restore"] },
  widgets: { name: "Виджеты", permissions: ["view", "edit"] },
  settings: { name: "Настройки", permissions: ["view", "edit"] },
  audit: { name: "Аудит", permissions: ["view", "restore"] },
};

const PERMISSION_SECTIONS = [
  { title: "Операции", modules: ["opt", "refueling", "movement", "rent", "transportation"] },
  { title: "ЛИК", modules: ["lik-refueling", "lik-movement", "equipment"] },
  { title: "Зарубеж", modules: ["abroad", "storage-cards"] },
  { title: "Биржа", modules: ["exchange-deals", "exchange-advances", "exchange"] },
  { title: "Данные", modules: ["warehouses", "prices", "counterparties", "delivery", "directories"] },
  { title: "Финансы", modules: ["finance"] },
  { title: "Отчеты", modules: ["reports"] },
  { title: "Планирование", modules: ["planning"] },
  { title: "Администрирование", modules: ["users", "roles", "widgets", "settings", "audit"] },
];

const PERMISSION_LABELS: Record<string, { icon: React.ElementType; label: string }> = {
  view: { icon: Eye, label: "Просмотр" },
  create: { icon: PlusIcon, label: "Создание" },
  edit: { icon: Edit3, label: "Редактирование" },
  delete: { icon: Trash, label: "Удаление" },
  restore: { icon: History, label: "Восстановление" },
  export: { icon: Eye, label: "Экспорт" },
};

const roleFormSchema = z.object({
  name: z.string().min(1, "Укажите название"),
  description: z.string().optional(),
  permissions: z.array(z.string()).default([]),
});

type RoleFormData = z.infer<typeof roleFormSchema>;

function RoleFormDialog({ 
  editRole,
  onSuccess
}: { 
  editRole?: Role | null;
  onSuccess?: () => void;
}) {
  const { toast } = useToast();
  const { showError, ErrorModalComponent } = useErrorModal();
  const [open, setOpen] = useState(!!editRole);

  const form = useForm<RoleFormData>({
    resolver: zodResolver(roleFormSchema),
    defaultValues: {
      name: editRole?.name || "",
      description: editRole?.description || "",
      permissions: editRole?.permissions || [],
    },
  });

  const mutation = useMutation({
    mutationFn: async (data: RoleFormData) => {
      if (editRole) {
        const res = await apiRequest("PATCH", `/api/roles/${editRole.id}`, data);
        return res.json();
      } else {
        const res = await apiRequest("POST", "/api/roles", data);
        return res.json();
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/roles"] });
      toast({ 
        title: editRole ? "Роль обновлена" : "Роль создана", 
        description: editRole ? "Изменения сохранены" : "Новая роль добавлена" 
      });
      form.reset();
      setOpen(false);
      onSuccess?.();
    },
    onError: (error: Error) => {
      showError(error.message);
    },
  });

  const togglePermission = (permissionKey: string) => {
    const current = form.getValues("permissions");
    if (current.includes(permissionKey)) {
      form.setValue("permissions", current.filter(p => p !== permissionKey));
    } else {
      form.setValue("permissions", [...current, permissionKey]);
    }
  };

  const toggleModuleAll = (moduleKey: string, checked: boolean) => {
    const module = PERMISSION_MODULES[moduleKey as keyof typeof PERMISSION_MODULES];
    const modulePermissions = module.permissions.map(p => `${moduleKey}.${p}`);
    const current = form.getValues("permissions");
    
    if (checked) {
      form.setValue("permissions", [...new Set([...current, ...modulePermissions])]);
    } else {
      form.setValue("permissions", current.filter(p => !modulePermissions.includes(p)));
    }
  };

  const isModuleFullyChecked = (moduleKey: string) => {
    const module = PERMISSION_MODULES[moduleKey as keyof typeof PERMISSION_MODULES];
    const modulePermissions = module.permissions.map(p => `${moduleKey}.${p}`);
    const current = form.watch("permissions");
    return modulePermissions.every(p => current.includes(p));
  };

  const isModulePartiallyChecked = (moduleKey: string) => {
    const module = PERMISSION_MODULES[moduleKey as keyof typeof PERMISSION_MODULES];
    const modulePermissions = module.permissions.map(p => `${moduleKey}.${p}`);
    const current = form.watch("permissions");
    const checkedCount = modulePermissions.filter(p => current.includes(p)).length;
    return checkedCount > 0 && checkedCount < modulePermissions.length;
  };

  const handleOpenChange = (isOpen: boolean) => {
    setOpen(isOpen);
    if (!isOpen && onSuccess) {
      onSuccess();
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      {!editRole && (
        <DialogTrigger asChild>
          <Button data-testid="button-add-role">
            <Plus className="mr-2 h-4 w-4" />
            Создать роль
          </Button>
        </DialogTrigger>
      )}
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editRole ? "Редактирование роли" : "Новая роль"}</DialogTitle>
          <DialogDescription>
            {editRole ? "Изменение параметров роли и прав доступа" : "Создание новой роли с настройкой прав"}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit((data) => mutation.mutate(data))} className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Название</FormLabel>
                    <FormControl>
                      <Input placeholder="Администратор" data-testid="input-role-name" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Описание</FormLabel>
                    <FormControl>
                      <Input placeholder="Краткое описание" data-testid="input-role-description" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="space-y-4">
              <Label className="text-base font-medium">Права доступа</Label>
              <Accordion type="multiple" className="w-full">
                {PERMISSION_SECTIONS.map((section) => (
                  <div key={section.title}>
                    <div className="px-1 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider border-b border-border mb-1 mt-2">
                      {section.title}
                    </div>
                    {section.modules.map((moduleKey) => {
                      const module = PERMISSION_MODULES[moduleKey as keyof typeof PERMISSION_MODULES];
                      if (!module) return null;
                      return (
                        <AccordionItem key={moduleKey} value={moduleKey}>
                          <AccordionTrigger className="hover:no-underline">
                            <div className="flex items-center gap-3">
                              <Checkbox
                                checked={isModuleFullyChecked(moduleKey)}
                                onCheckedChange={(checked) => toggleModuleAll(moduleKey, !!checked)}
                                onClick={(e) => e.stopPropagation()}
                                className={isModulePartiallyChecked(moduleKey) ? "opacity-50" : ""}
                              />
                              <span>{module.name}</span>
                              <Badge variant="outline" className="ml-2 text-xs">
                                {form.watch("permissions").filter(p => p.startsWith(`${moduleKey}.`)).length}/{module.permissions.length}
                              </Badge>
                            </div>
                          </AccordionTrigger>
                          <AccordionContent>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pl-8 py-2">
                              {module.permissions.map((perm) => {
                                const permKey = `${moduleKey}.${perm}`;
                                const { icon: Icon, label } = PERMISSION_LABELS[perm] || { icon: Eye, label: perm };
                                const isChecked = form.watch("permissions").includes(permKey);
                                return (
                                  <div key={permKey} className="flex items-center gap-2">
                                    <Checkbox
                                      id={permKey}
                                      checked={isChecked}
                                      onCheckedChange={() => togglePermission(permKey)}
                                    />
                                    <Label htmlFor={permKey} className="flex items-center gap-1.5 text-sm font-normal cursor-pointer">
                                      <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                                      {label}
                                    </Label>
                                  </div>
                                );
                              })}
                            </div>
                          </AccordionContent>
                        </AccordionItem>
                      );
                    })}
                  </div>
                ))}
              </Accordion>
            </div>

            <div className="flex justify-end gap-4 pt-4 border-t">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Отмена</Button>
              <Button type="submit" disabled={mutation.isPending} data-testid="button-save-role">
                {mutation.isPending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Сохранение...</> : editRole ? "Сохранить" : "Создать"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
      <ErrorModalComponent />
    </Dialog>
  );
}

export default function RolesPage() {
  const [search, setSearch] = useState("");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [roleToDelete, setRoleToDelete] = useState<Role | null>(null);
  const [roleToEdit, setRoleToEdit] = useState<Role | null>(null);
  const [auditPanelOpen, setAuditPanelOpen] = useState(false);
  const { toast } = useToast();
  const { showError, ErrorModalComponent } = useErrorModal();
  const { hasPermission } = useAuth();

  const { data: roles, isLoading } = useQuery<Role[]>({
    queryKey: ["/api/roles"],
  });

  const filteredRoles = roles?.filter(r => 
    r.name.toLowerCase().includes(search.toLowerCase())
  ) || [];

  const countPermissions = (permissions: string[] | null) => permissions?.length || 0;

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("DELETE", `/api/roles/${id}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/roles"] });
      toast({ title: "Роль удалена", description: "Запись успешно удалена" });
    },
    onError: () => {
      showError("Не удалось удалить роль");
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Роли</h1>
          <p className="text-muted-foreground">Управление ролями и правами доступа</p>
        </div>
        {hasPermission("roles", "create") && (
          <RoleFormDialog />
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Shield className="h-4 w-4" />
              Всего ролей
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{roles?.length || 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Модулей с правами</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{Object.keys(PERMISSION_MODULES).length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Users className="h-4 w-4" />
              Типов действий
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{Object.keys(PERMISSION_LABELS).length}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Список ролей</CardTitle>
          <CardDescription>Все роли в системе и их права</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Поиск ролей..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" data-testid="input-search-roles" />
              </div>
              <Button
                variant="outline"
                onClick={() => setAuditPanelOpen(true)}
                title="Аудит всех ролей"
              >
                <History className="h-4 w-4 mr-2" />
                История изменений
              </Button>
            </div>

            <div className="border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Название</TableHead>
                    <TableHead>Описание</TableHead>
                    <TableHead>Права</TableHead>
                    <TableHead>Тип</TableHead>
                    <TableHead className="w-[100px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    [1, 2, 3].map((i) => (
                      <TableRow key={i}><TableCell colSpan={5}><Skeleton className="h-12 w-full" /></TableCell></TableRow>
                    ))
                  ) : filteredRoles.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                        <Shield className="h-8 w-8 mx-auto mb-2 opacity-50" />
                        Нет ролей
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredRoles.map((role) => (
                      <TableRow key={role.id}>
                        <TableCell className="font-medium">{role.name}</TableCell>
                        <TableCell className="text-muted-foreground max-w-xs truncate">{role.description || "—"}</TableCell>
                        <TableCell>
                          <Badge variant="secondary">{countPermissions(role.permissions)} прав</Badge>
                        </TableCell>
                        <TableCell>
                          {role.isSystem ? (
                            <Badge variant="outline" className="text-blue-600 border-blue-600">Системная</Badge>
                          ) : (
                            <Badge variant="outline">Пользовательская</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <EntityActionsMenu
                            actions={[
                              {
                                id: "edit",
                                label: "Редактировать",
                                icon: Pencil,
                                onClick: () => setRoleToEdit(role),
                                permission: { module: "roles", action: "edit" },
                              },
                              {
                                id: "delete",
                                label: "Удалить",
                                icon: Trash2,
                                onClick: () => {
                                  setRoleToDelete(role);
                                  setDeleteDialogOpen(true);
                                },
                                variant: "destructive" as const,
                                permission: { module: "roles", action: "delete" },
                                condition: !role.isSystem,
                                separatorAfter: true,
                              },
                            ]}
                            audit={{
                              entityType: "roles",
                              entityId: role.id,
                              entityName: role.name,
                            }}
                            triggerClassName="h-8 w-8"
                          />
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </CardContent>
      </Card>

      {roleToEdit && (
        <RoleFormDialog
          editRole={roleToEdit}
          onSuccess={() => setRoleToEdit(null)}
        />
      )}

      <DeleteConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onConfirm={() => {
          if (roleToDelete) {
            deleteMutation.mutate(roleToDelete.id);
          }
          setDeleteDialogOpen(false);
          setRoleToDelete(null);
        }}
        title="Удалить роль?"
        description="Вы уверены, что хотите удалить эту роль? Это действие нельзя отменить."
        itemName={roleToDelete?.name}
      />

      <AuditPanel
        open={auditPanelOpen}
        onOpenChange={setAuditPanelOpen}
        entityType="roles"
        entityId=""
      />
      <ErrorModalComponent />
    </div>
  );
}
