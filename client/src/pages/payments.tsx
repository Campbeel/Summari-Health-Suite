import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  CreditCard, 
  Download,
  Calendar,
  CheckCircle2,
  Clock,
  XCircle
} from "lucide-react";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";

interface PaymentRecord {
  id: string;
  amount: number;
  currency: string;
  status: string;
  createdAt: string;
  appointmentId?: number;
  doctorName?: string;
  doctorSpecialty?: string;
}

function getStatusBadge(status: string) {
  switch (status) {
    case "succeeded":
    case "paid":
      return (
        <Badge className="bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300">
          <CheckCircle2 className="h-3 w-3 mr-1" />
          Completado
        </Badge>
      );
    case "pending":
    case "processing":
      return (
        <Badge variant="outline" className="text-amber-600 border-amber-300">
          <Clock className="h-3 w-3 mr-1" />
          Pendiente
        </Badge>
      );
    case "failed":
    case "canceled":
    case "rejected":
    case "cancelled":
      return (
        <Badge variant="destructive">
          <XCircle className="h-3 w-3 mr-1" />
          Fallido
        </Badge>
      );
    default:
      return <Badge variant="secondary">{status}</Badge>;
  }
}

export default function PaymentsPage() {
  const { data: payments, isLoading } = useQuery<PaymentRecord[]>({
    queryKey: ["/api/payments"],
  });

  const totalPaid = payments
    ?.filter(p => p.status === "succeeded")
    .reduce((sum, p) => sum + p.amount, 0) || 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold">Mis Pagos</h1>
        <p className="text-muted-foreground mt-1">
          Historial de pagos y transacciones
        </p>
      </div>

      {/* Summary Card */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-lg bg-green-100 dark:bg-green-950 flex items-center justify-center">
              <CreditCard className="h-6 w-6 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total pagado</p>
              <p className="text-2xl font-bold">${totalPaid.toLocaleString()} CLP</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Payments List */}
      <Card>
        <CardHeader>
          <CardTitle>Historial de Transacciones</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-center gap-4 p-4 border rounded-lg">
                  <Skeleton className="h-10 w-10 rounded" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                  <Skeleton className="h-6 w-20" />
                </div>
              ))}
            </div>
          ) : payments && payments.length > 0 ? (
            <div className="space-y-3">
              {payments.map((payment) => (
                <div 
                  key={payment.id} 
                  className="flex items-center gap-4 p-4 border rounded-lg hover-elevate"
                  data-testid={`payment-${payment.id}`}
                >
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <CreditCard className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium">
                      {payment.doctorName ? `Consulta con ${payment.doctorName}` : "Pago de consulta"}
                    </p>
                    <p className="text-sm text-muted-foreground flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {format(parseISO(payment.createdAt), "d 'de' MMMM, yyyy", { locale: es })}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold">${payment.amount.toLocaleString()}</p>
                    <p className="text-xs text-muted-foreground uppercase">{payment.currency}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {getStatusBadge(payment.status)}
                    {payment.status === "succeeded" && (
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <Download className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <CreditCard className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="font-medium text-lg mb-2">No hay pagos registrados</h3>
              <p className="text-muted-foreground">
                Los pagos de tus consultas aparecerán aquí
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
