import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { useTheme } from "@/components/theme-provider";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Settings,
  User,
  Shield,
  Moon,
  Sun,
  Save,
  Key,
  Globe,
  Loader2,
} from "lucide-react";

const profileSchema = z.object({
  firstName: z.string().min(1, "Имя обязательно"),
  lastName: z.string().min(1, "Фамилия обязательна"),
  email: z.string().email("Некорректный email"),
});

const passwordSchema = z
  .object({
    currentPassword: z.string().min(1, "Введите текущий пароль"),
    newPassword: z.string().min(6, "Пароль должен быть не менее 6 символов"),
    confirmPassword: z.string().min(1, "Подтвердите пароль"),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Пароли не совпадают",
    path: ["confirmPassword"],
  });

type ProfileFormValues = z.infer<typeof profileSchema>;
type PasswordFormValues = z.infer<typeof passwordSchema>;

export default function SettingsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const { theme, toggleTheme } = useTheme();

  const getInitials = (firstName: string, lastName: string) =>
    `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();

  const profileForm = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      firstName: user?.firstName ?? "",
      lastName: user?.lastName ?? "",
      email: user?.email ?? "",
    },
  });

  useEffect(() => {
    if (user) {
      profileForm.reset({
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
      });
    }
  }, [user]);

  const passwordForm = useForm<PasswordFormValues>({
    resolver: zodResolver(passwordSchema),
    defaultValues: {
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    },
  });

  const profileMutation = useMutation({
    mutationFn: async (data: ProfileFormValues) => {
      const res = await apiRequest("PATCH", "/api/auth/profile", data);
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Ошибка обновления профиля");
      }
      return res.json();
    },
    onSuccess: (updatedUser) => {
      queryClient.setQueryData(["/api/auth/user"], updatedUser);
      toast({ title: "Профиль обновлён", description: "Изменения успешно сохранены" });
    },
    onError: (error: Error) => {
      toast({ title: "Ошибка", description: error.message, variant: "destructive" });
    },
  });

  const passwordMutation = useMutation({
    mutationFn: async (data: PasswordFormValues) => {
      const res = await apiRequest("PATCH", "/api/auth/change-password", data);
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Ошибка смены пароля");
      }
      return res.json();
    },
    onSuccess: () => {
      passwordForm.reset();
      toast({ title: "Пароль изменён", description: "Новый пароль успешно установлен" });
    },
    onError: (error: Error) => {
      if (error.message.includes("Текущий пароль")) {
        passwordForm.setError("currentPassword", { message: error.message });
      } else {
        toast({ title: "Ошибка", description: error.message, variant: "destructive" });
      }
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Настройки</h1>
        <p className="text-muted-foreground">Управление параметрами системы и профилем</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">

          {/* ── Профиль ── */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                Профиль пользователя
              </CardTitle>
              <CardDescription>Информация о вашей учетной записи</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center gap-6">
                <Avatar className="h-20 w-20">
                  <AvatarFallback className="text-xl bg-primary text-primary-foreground">
                    {user ? getInitials(user.firstName, user.lastName) : "??"}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 space-y-1">
                  <h3 className="text-lg font-medium">
                    {user ? `${user.lastName} ${user.firstName}`.trim() : "Гость"}
                  </h3>
                  <p className="text-sm text-muted-foreground">{user?.email}</p>
                  <Badge variant="outline">Роль: {user?.role?.name}</Badge>
                </div>
              </div>

              <Separator />

              <form
                onSubmit={profileForm.handleSubmit((data) => profileMutation.mutate(data))}
                className="space-y-4"
              >
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="firstName">Имя</Label>
                    <Input
                      id="firstName"
                      {...profileForm.register("firstName")}
                      data-testid="input-settings-firstname"
                    />
                    {profileForm.formState.errors.firstName && (
                      <p className="text-sm text-destructive">
                        {profileForm.formState.errors.firstName.message}
                      </p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="lastName">Фамилия</Label>
                    <Input
                      id="lastName"
                      {...profileForm.register("lastName")}
                      data-testid="input-settings-lastname"
                    />
                    {profileForm.formState.errors.lastName && (
                      <p className="text-sm text-destructive">
                        {profileForm.formState.errors.lastName.message}
                      </p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      {...profileForm.register("email")}
                      data-testid="input-settings-email"
                    />
                    {profileForm.formState.errors.email && (
                      <p className="text-sm text-destructive">
                        {profileForm.formState.errors.email.message}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex justify-end">
                  <Button
                    type="submit"
                    disabled={profileMutation.isPending}
                    data-testid="button-save-profile"
                  >
                    {profileMutation.isPending ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Save className="mr-2 h-4 w-4" />
                    )}
                    Сохранить изменения
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

          {/* ── Безопасность ── */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Key className="h-5 w-5" />
                Безопасность
              </CardTitle>
              <CardDescription>Управление паролем и безопасностью</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <form
                onSubmit={passwordForm.handleSubmit((data) => passwordMutation.mutate(data))}
                className="space-y-4"
              >
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="currentPassword">Текущий пароль</Label>
                    <Input
                      id="currentPassword"
                      type="password"
                      placeholder="••••••••"
                      {...passwordForm.register("currentPassword")}
                      data-testid="input-current-password"
                    />
                    {passwordForm.formState.errors.currentPassword && (
                      <p className="text-sm text-destructive">
                        {passwordForm.formState.errors.currentPassword.message}
                      </p>
                    )}
                  </div>
                  <div />
                  <div className="space-y-2">
                    <Label htmlFor="newPassword">Новый пароль</Label>
                    <Input
                      id="newPassword"
                      type="password"
                      placeholder="••••••••"
                      {...passwordForm.register("newPassword")}
                      data-testid="input-new-password"
                    />
                    {passwordForm.formState.errors.newPassword && (
                      <p className="text-sm text-destructive">
                        {passwordForm.formState.errors.newPassword.message}
                      </p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="confirmPassword">Подтвердите пароль</Label>
                    <Input
                      id="confirmPassword"
                      type="password"
                      placeholder="••••••••"
                      {...passwordForm.register("confirmPassword")}
                      data-testid="input-confirm-password"
                    />
                    {passwordForm.formState.errors.confirmPassword && (
                      <p className="text-sm text-destructive">
                        {passwordForm.formState.errors.confirmPassword.message}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex justify-end">
                  <Button
                    type="submit"
                    variant="outline"
                    disabled={passwordMutation.isPending}
                    data-testid="button-change-password"
                  >
                    {passwordMutation.isPending ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Key className="mr-2 h-4 w-4" />
                    )}
                    Изменить пароль
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                Интерфейс
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between gap-1">
                <div className="flex items-center gap-3">
                  {theme === "light" ? (
                    <Sun className="h-5 w-5 text-yellow-500" />
                  ) : (
                    <Moon className="h-5 w-5 text-blue-500" />
                  )}
                  <div>
                    <p className="font-medium">Тема</p>
                    <p className="text-sm text-muted-foreground">
                      {theme === "light" ? "Светлая" : "Темная"}
                    </p>
                  </div>
                </div>
                <Switch
                  checked={theme === "dark"}
                  onCheckedChange={toggleTheme}
                  data-testid="switch-theme"
                />
              </div>
              <Separator />
              <div className="flex items-center justify-between gap-1">
                <div className="flex items-center gap-3">
                  <Globe className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="font-medium">Язык</p>
                    <p className="text-sm text-muted-foreground">Русский</p>
                  </div>
                </div>
                <Badge variant="outline">RU</Badge>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
