import { useState, useEffect } from "react";
import { Link, useLocation, useSearch } from "wouter";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Eye, EyeOff, CheckCircle, XCircle } from "lucide-react";
import { BrandLogo } from "@/components/brand-logo";

export default function ResetPasswordPage() {
  const [, navigate] = useLocation();
  const search = useSearch();
  const { toast } = useToast();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [success, setSuccess] = useState(false);

  const params = new URLSearchParams(search);
  const token = params.get("token") || "";

  const { data: tokenStatus, isLoading: verifying } = useQuery<{ valid: boolean; error?: string }>({
    queryKey: ["/api/auth/verify-reset-token", token],
    queryFn: async () => {
      const res = await fetch(`/api/auth/verify-reset-token/${token}`);
      return res.json();
    },
    enabled: !!token,
    retry: false,
  });

  const resetMutation = useMutation({
    mutationFn: async (data: { token: string; password: string }) => {
      const response = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Error al restablecer la contraseña");
      }
      return response.json();
    },
    onSuccess: () => {
      setSuccess(true);
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      toast({ title: "Error", description: "Las contraseñas no coinciden", variant: "destructive" });
      return;
    }
    if (password.length < 6) {
      toast({ title: "Error", description: "La contraseña debe tener al menos 6 caracteres", variant: "destructive" });
      return;
    }
    resetMutation.mutate({ token, password });
  };

  if (!token) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="w-full max-w-md space-y-6">
          <div className="flex flex-col items-center gap-3">
            <BrandLogo variant="logotype" className="h-10" />
          </div>
          <Card>
            <CardContent className="pt-6 text-center space-y-4">
              <XCircle className="h-12 w-12 text-destructive mx-auto" />
              <p className="font-medium">Enlace inválido</p>
              <p className="text-sm text-muted-foreground">
                El enlace de recuperación no es válido. Solicita uno nuevo.
              </p>
              <Button asChild className="w-full" data-testid="button-request-new">
                <Link href="/recuperar-contrasena">Solicitar nuevo enlace</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (verifying) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (tokenStatus && !tokenStatus.valid) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="w-full max-w-md space-y-6">
          <div className="flex flex-col items-center gap-3">
            <BrandLogo variant="logotype" className="h-10" />
          </div>
          <Card>
            <CardContent className="pt-6 text-center space-y-4">
              <XCircle className="h-12 w-12 text-destructive mx-auto" />
              <p className="font-medium">Enlace expirado</p>
              <p className="text-sm text-muted-foreground">
                Este enlace ha expirado o ya fue utilizado. Solicita uno nuevo para restablecer tu contraseña.
              </p>
              <Button asChild className="w-full" data-testid="button-request-new-expired">
                <Link href="/recuperar-contrasena">Solicitar nuevo enlace</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="flex flex-col items-center gap-3">
          <Link href="/" data-testid="text-reset-title">
            <BrandLogo variant="logotype" className="h-10" />
          </Link>
          <p className="text-muted-foreground text-sm">Telemedicina</p>
        </div>

        <Card>
          <CardHeader className="space-y-1">
            <CardTitle className="text-xl" data-testid="text-reset-card-title">
              {success ? "Contraseña restablecida" : "Nueva contraseña"}
            </CardTitle>
            <CardDescription>
              {success
                ? "Tu contraseña ha sido actualizada correctamente."
                : "Ingresa tu nueva contraseña."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {success ? (
              <div className="space-y-4">
                <div className="flex justify-center py-4">
                  <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-950 flex items-center justify-center">
                    <CheckCircle className="h-8 w-8 text-green-600 dark:text-green-400" />
                  </div>
                </div>
                <p className="text-sm text-muted-foreground text-center">
                  Ya puedes iniciar sesión con tu nueva contraseña.
                </p>
                <Button
                  className="w-full"
                  onClick={() => navigate("/login")}
                  data-testid="button-go-to-login"
                >
                  Ir a Iniciar Sesión
                </Button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="password">Nueva contraseña</Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      placeholder="Mínimo 6 caracteres"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      minLength={6}
                      data-testid="input-new-password"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-0 top-0"
                      onClick={() => setShowPassword(!showPassword)}
                      data-testid="button-toggle-new-password"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">Confirmar contraseña</Label>
                  <div className="relative">
                    <Input
                      id="confirmPassword"
                      type={showConfirm ? "text" : "password"}
                      placeholder="Repite tu contraseña"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                      minLength={6}
                      data-testid="input-confirm-password"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-0 top-0"
                      onClick={() => setShowConfirm(!showConfirm)}
                      data-testid="button-toggle-confirm-password"
                    >
                      {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                  {confirmPassword && password !== confirmPassword && (
                    <p className="text-sm text-destructive" data-testid="text-password-mismatch">
                      Las contraseñas no coinciden
                    </p>
                  )}
                </div>
                <Button
                  type="submit"
                  className="w-full"
                  disabled={resetMutation.isPending || password !== confirmPassword}
                  data-testid="button-reset-submit"
                >
                  {resetMutation.isPending ? "Restableciendo..." : "Restablecer Contraseña"}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
