import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { loginWithToken } from "@/hooks/use-auth";
import { homeForRole, type UserRole } from "@/hooks/use-role";
import { Eye, EyeOff } from "lucide-react";
import { BrandLogo } from "@/components/brand-logo";
import { ThemeToggle } from "@/components/theme-toggle";

export default function AuthLoginPage() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [showPassword, setShowPassword] = useState(false);
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [fieldErrors, setFieldErrors] = useState<{ identifier?: string; password?: string }>({});

  const loginMutation = useMutation({
    mutationFn: async (data: { identifier: string; password: string }) => {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Error al iniciar sesión");
      }
      return response.json();
    },
    onSuccess: (data) => {
      loginWithToken(data.token, data.user);
      toast({ title: "Bienvenido", description: "Has iniciado sesión correctamente" });
      const role = (data.user?.role === "doctor" ? "staff" : data.user?.role) as UserRole;
      navigate(homeForRole(role));
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const errors: { identifier?: string; password?: string } = {};
    if (!identifier.trim()) errors.identifier = "Ingresa tu RUT o correo electrónico";
    if (!password) errors.password = "Ingresa tu contraseña";
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }
    setFieldErrors({});
    loginMutation.mutate({ identifier, password });
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4 relative">
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>
      <div className="w-full max-w-md space-y-6">
        <div className="flex flex-col items-center gap-3">
          <Link href="/" data-testid="link-login-home">
            <BrandLogo variant="logotype" className="h-10" />
          </Link>
          <p className="text-muted-foreground text-sm" data-testid="text-login-title">Telemedicina</p>
        </div>

        <Card>
          <CardHeader className="space-y-1">
            <CardTitle className="text-xl" data-testid="text-login-card-title">Acceso personal</CardTitle>
            <CardDescription>Solo personal autorizado del centro</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="identifier">RUT o Correo electrónico</Label>
                <Input
                  id="identifier"
                  type="text"
                  placeholder="12.345.678-9 o tu@correo.com"
                  value={identifier}
                  onChange={(e) => { setIdentifier(e.target.value); setFieldErrors(prev => ({ ...prev, identifier: undefined })); }}
                  className={fieldErrors.identifier ? "border-destructive" : ""}
                  data-testid="input-login-identifier"
                />
                {fieldErrors.identifier && (
                  <p className="text-sm text-destructive" data-testid="error-login-identifier">{fieldErrors.identifier}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Contraseña</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Tu contraseña"
                    value={password}
                    onChange={(e) => { setPassword(e.target.value); setFieldErrors(prev => ({ ...prev, password: undefined })); }}
                    className={fieldErrors.password ? "border-destructive" : ""}
                    data-testid="input-login-password"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-0 top-0"
                    onClick={() => setShowPassword(!showPassword)}
                    data-testid="button-toggle-password"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
                {fieldErrors.password && (
                  <p className="text-sm text-destructive" data-testid="error-login-password">{fieldErrors.password}</p>
                )}
              </div>
              <Button
                type="submit"
                className="w-full"
                disabled={loginMutation.isPending}
                data-testid="button-login-submit"
              >
                {loginMutation.isPending ? "Ingresando..." : "Iniciar Sesión"}
              </Button>
              <div className="text-right">
                <Link
                  href="/recuperar-contrasena"
                  className="text-sm text-muted-foreground hover:underline"
                  data-testid="link-forgot-password"
                >
                  ¿Olvidaste tu contraseña?
                </Link>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
