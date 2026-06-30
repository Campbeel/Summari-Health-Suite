import { useState } from "react";
import { Link } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Mail } from "lucide-react";
import { BrandLogo } from "@/components/brand-logo";

export default function ForgotPasswordPage() {
  const { toast } = useToast();
  const [identifier, setIdentifier] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [fieldError, setFieldError] = useState("");

  const resetMutation = useMutation({
    mutationFn: async (data: { identifier: string }) => {
      const response = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Error al procesar la solicitud");
      }
      return response.json();
    },
    onSuccess: () => {
      setSubmitted(true);
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!identifier.trim()) {
      setFieldError("Ingresa tu RUT o correo electrónico");
      return;
    }
    setFieldError("");
    resetMutation.mutate({ identifier });
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="flex flex-col items-center gap-3">
          <Link href="/" data-testid="text-forgot-title">
            <BrandLogo variant="logotype" className="h-10" />
          </Link>
          <p className="text-muted-foreground text-sm">Telemedicina</p>
        </div>

        <Card>
          <CardHeader className="space-y-1">
            <CardTitle className="text-xl" data-testid="text-forgot-card-title">
              {submitted ? "Revisa tu correo" : "Recuperar contraseña"}
            </CardTitle>
            <CardDescription>
              {submitted
                ? "Te hemos enviado un enlace para restablecer tu contraseña."
                : "Ingresa tu RUT o correo electrónico para recibir un enlace de recuperación."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {submitted ? (
              <div className="space-y-4">
                <div className="flex justify-center py-4">
                  <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                    <Mail className="h-8 w-8 text-primary" />
                  </div>
                </div>
                <p className="text-sm text-muted-foreground text-center">
                  Si existe una cuenta asociada a los datos ingresados, recibirás un correo con instrucciones
                  para restablecer tu contraseña. El enlace expirará en 1 hora.
                </p>
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => { setSubmitted(false); setIdentifier(""); }}
                  data-testid="button-try-again"
                >
                  Intentar con otro dato
                </Button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="identifier">RUT o Correo electrónico</Label>
                  <Input
                    id="identifier"
                    type="text"
                    placeholder="12.345.678-9 o tu@correo.com"
                    value={identifier}
                    onChange={(e) => { setIdentifier(e.target.value); setFieldError(""); }}
                    className={fieldError ? "border-destructive" : ""}
                    data-testid="input-forgot-identifier"
                  />
                  {fieldError && (
                    <p className="text-sm text-destructive" data-testid="error-forgot-identifier">{fieldError}</p>
                  )}
                </div>
                <Button
                  type="submit"
                  className="w-full"
                  disabled={resetMutation.isPending}
                  data-testid="button-forgot-submit"
                >
                  {resetMutation.isPending ? "Enviando..." : "Enviar enlace de recuperación"}
                </Button>
              </form>
            )}
            <div className="mt-4 text-center">
              <Link
                href="/"
                className="text-sm text-muted-foreground inline-flex items-center gap-1 hover:underline"
                data-testid="link-back-to-login"
              >
                <ArrowLeft className="h-3 w-3" />
                Volver al inicio de sesión
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
