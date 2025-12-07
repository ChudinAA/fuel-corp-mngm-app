import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { useTheme } from "@/components/theme-provider";
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
  Bell,
  Shield,
  Database,
  Moon,
  Sun,
  Save,
  Key,
  Mail,
  Smartphone,
  Globe
} from "lucide-react";

export default function SettingsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const { theme, toggleTheme } = useTheme();
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [browserNotifications, setBrowserNotifications] = useState(false);

  const getInitials = (firstName: string, lastName: string) => 
    `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();

  const handleSave = () => {
    toast({ title: "Настройки сохранены", description: "Изменения успешно применены" });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Настройки</h1>
        <p className="text-muted-foreground">Управление параметрами системы и профилем</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
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
                  <Badge variant="outline">Роль: Администратор</Badge>
                </div>
                <Button variant="outline">Изменить фото</Button>
              </div>

              <Separator />

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Имя</Label>
                  <Input defaultValue={user?.firstName} data-testid="input-settings-firstname" />
                </div>
                <div className="space-y-2">
                  <Label>Фамилия</Label>
                  <Input defaultValue={user?.lastName} data-testid="input-settings-lastname" />
                </div>
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input type="email" defaultValue={user?.email} data-testid="input-settings-email" />
                </div>
              </div>

              <div className="flex justify-end">
                <Button onClick={handleSave} data-testid="button-save-profile">
                  <Save className="mr-2 h-4 w-4" />
                  Сохранить изменения
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Key className="h-5 w-5" />
                Безопасность
              </CardTitle>
              <CardDescription>Управление паролем и безопасностью</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Текущий пароль</Label>
                  <Input type="password" placeholder="••••••••" data-testid="input-current-password" />
                </div>
                <div></div>
                <div className="space-y-2">
                  <Label>Новый пароль</Label>
                  <Input type="password" placeholder="••••••••" data-testid="input-new-password" />
                </div>
                <div className="space-y-2">
                  <Label>Подтвердите пароль</Label>
                  <Input type="password" placeholder="••••••••" data-testid="input-confirm-password" />
                </div>
              </div>
              <div className="flex justify-end">
                <Button variant="outline" data-testid="button-change-password">
                  <Key className="mr-2 h-4 w-4" />
                  Изменить пароль
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bell className="h-5 w-5" />
                Уведомления
              </CardTitle>
              <CardDescription>Настройки уведомлений и оповещений</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Mail className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="font-medium">Email-уведомления</p>
                    <p className="text-sm text-muted-foreground">Получать уведомления на почту</p>
                  </div>
                </div>
                <Switch
                  checked={emailNotifications}
                  onCheckedChange={setEmailNotifications}
                  data-testid="switch-email-notifications"
                />
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Smartphone className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="font-medium">Push-уведомления</p>
                    <p className="text-sm text-muted-foreground">Уведомления в браузере</p>
                  </div>
                </div>
                <Switch
                  checked={browserNotifications}
                  onCheckedChange={setBrowserNotifications}
                  data-testid="switch-browser-notifications"
                />
              </div>
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
              <div className="flex items-center justify-between">
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
              <div className="flex items-center justify-between">
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

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Database className="h-5 w-5" />
                Система
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Версия</span>
                  <span className="font-medium">1.0.0</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">База данных</span>
                  <Badge variant="outline" className="text-green-600 border-green-600">Подключена</Badge>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Последнее обновление</span>
                  <span className="font-medium">01.12.2025</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Сессия
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Вы вошли в систему как {user?.email}
              </p>
              <div className="space-y-2">
                <Button variant="outline" className="w-full" data-testid="button-logout-all">
                  Выйти со всех устройств
                </Button>
                <Button variant="destructive" className="w-full" data-testid="button-delete-account">
                  Удалить аккаунт
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
