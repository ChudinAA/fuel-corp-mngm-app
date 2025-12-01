import { createContext, ReactNode, useContext, useMemo } from "react";
import {
  useQuery,
  useMutation,
  UseMutationResult,
} from "@tanstack/react-query";
import { User, LoginCredentials, RegisterUser, Role } from "@shared/schema";
import { getQueryFn, apiRequest, queryClient } from "../lib/queryClient";
import { useToast } from "@/hooks/use-toast";

type UserWithRole = User & { role: Role | null };

type AuthContextType = {
  user: UserWithRole | null;
  isLoading: boolean;
  error: Error | null;
  loginMutation: UseMutationResult<UserWithRole, Error, LoginCredentials>;
  logoutMutation: UseMutationResult<void, Error, void>;
  registerMutation: UseMutationResult<UserWithRole, Error, RegisterUser>;
  hasPermission: (module: string, action: string) => boolean;
  isAdmin: boolean;
};

export const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const { toast } = useToast();
  
  const {
    data: user,
    error,
    isLoading,
  } = useQuery<UserWithRole | undefined, Error>({
    queryKey: ["/api/auth/user"],
    queryFn: getQueryFn({ on401: "returnNull" }),
  });

  const loginMutation = useMutation({
    mutationFn: async (credentials: LoginCredentials) => {
      const res = await apiRequest("POST", "/api/auth/login", credentials);
      return await res.json();
    },
    onSuccess: (user: UserWithRole) => {
      queryClient.setQueryData(["/api/auth/user"], user);
      toast({
        title: "Вход выполнен",
        description: `Добро пожаловать, ${user.firstName}!`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Ошибка входа",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const registerMutation = useMutation({
    mutationFn: async (credentials: RegisterUser) => {
      const res = await apiRequest("POST", "/api/auth/register", credentials);
      return await res.json();
    },
    onSuccess: (user: UserWithRole) => {
      queryClient.setQueryData(["/api/auth/user"], user);
      toast({
        title: "Регистрация успешна",
        description: `Добро пожаловать, ${user.firstName}!`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Ошибка регистрации",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const logoutMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/auth/logout");
    },
    onSuccess: () => {
      queryClient.setQueryData(["/api/auth/user"], null);
      toast({
        title: "Выход выполнен",
        description: "Вы успешно вышли из системы",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Ошибка выхода",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const isAdmin = useMemo(() => {
    if (!user?.role) return false;
    return user.role.name === "Админ" || user.role.name === "Ген.дир";
  }, [user]);

  const hasPermission = useMemo(() => {
    return (module: string, action: string): boolean => {
      if (!user?.role) return false;
      if (user.role.name === "Админ" || user.role.name === "Ген.дир") return true;
      const permission = `${module}.${action}`;
      return user.role.permissions?.includes(permission) || false;
    };
  }, [user]);

  return (
    <AuthContext.Provider
      value={{
        user: user ?? null,
        isLoading,
        error,
        loginMutation,
        logoutMutation,
        registerMutation,
        hasPermission,
        isAdmin,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
