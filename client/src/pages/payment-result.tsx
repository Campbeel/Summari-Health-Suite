import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle, XCircle, Clock, Loader2 } from "lucide-react";

export default function PaymentResult() {
  const [, setLocation] = useLocation();
  const [commerceOrder, setCommerceOrder] = useState<string | null>(null);

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const order = urlParams.get("commerceOrder");
    setCommerceOrder(order);
  }, []);

  const { data: paymentStatus, isLoading, error } = useQuery({
    queryKey: ["/api/flow/status", commerceOrder],
    queryFn: async () => {
      if (!commerceOrder) return null;
      const token = localStorage.getItem("auth_token");
      const headers: Record<string, string> = {};
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }
      const response = await fetch(`/api/flow/status/${commerceOrder}`, { headers });
      if (!response.ok) throw new Error("Failed to fetch payment status");
      return response.json();
    },
    enabled: !!commerceOrder,
    refetchInterval: (query) => {
      if (query.state.data?.status === "pending") return 3000;
      return false;
    },
  });

  const getStatusIcon = () => {
    if (isLoading) return <Loader2 className="h-16 w-16 animate-spin text-muted-foreground" />;
    if (error) return <XCircle className="h-16 w-16 text-destructive" />;
    
    switch (paymentStatus?.status) {
      case "paid":
        return <CheckCircle className="h-16 w-16 text-green-500" />;
      case "pending":
        return <Clock className="h-16 w-16 text-yellow-500" />;
      case "rejected":
      case "cancelled":
        return <XCircle className="h-16 w-16 text-destructive" />;
      default:
        return <Clock className="h-16 w-16 text-muted-foreground" />;
    }
  };

  const getStatusTitle = () => {
    if (isLoading) return "Verificando pago...";
    if (error) return "Error al verificar el pago";
    
    switch (paymentStatus?.status) {
      case "paid":
        return "¡Pago exitoso!";
      case "pending":
        return "Pago pendiente";
      case "rejected":
        return "Pago rechazado";
      case "cancelled":
        return "Pago cancelado";
      default:
        return "Estado desconocido";
    }
  };

  const getStatusDescription = () => {
    if (isLoading) return "Estamos verificando el estado de tu pago...";
    if (error) return "No pudimos verificar el estado de tu pago. Por favor, intenta más tarde.";
    
    switch (paymentStatus?.status) {
      case "paid":
        return "Tu cita ha sido confirmada. Recibirás un recordatorio antes de tu consulta.";
      case "pending":
        return "Tu pago está siendo procesado. Esta página se actualizará automáticamente.";
      case "rejected":
        return "Tu pago fue rechazado. Por favor, intenta nuevamente con otro método de pago.";
      case "cancelled":
        return "El pago fue cancelado. Puedes intentar nuevamente cuando lo desees.";
      default:
        return "No pudimos determinar el estado del pago.";
    }
  };

  return (
    <div className="container mx-auto py-8 px-4 max-w-md" data-testid="page-payment-result">
      <Card>
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            {getStatusIcon()}
          </div>
          <CardTitle className="text-2xl" data-testid="text-payment-status-title">
            {getStatusTitle()}
          </CardTitle>
        </CardHeader>
        <CardContent className="text-center space-y-6">
          <p className="text-muted-foreground" data-testid="text-payment-status-description">
            {getStatusDescription()}
          </p>

          {paymentStatus?.amount && (
            <div className="bg-muted rounded-lg p-4">
              <p className="text-sm text-muted-foreground">Monto pagado</p>
              <p className="text-2xl font-bold" data-testid="text-payment-amount">
                ${paymentStatus.amount.toLocaleString()} {paymentStatus.currency}
              </p>
            </div>
          )}

          <div className="flex flex-col gap-2">
            <Button 
              onClick={() => setLocation("/appointments")}
              data-testid="button-view-appointments"
            >
              Ver mis citas
            </Button>
            <Button 
              variant="outline" 
              onClick={() => setLocation("/dashboard")}
              data-testid="button-go-dashboard"
            >
              Ir al panel principal
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
