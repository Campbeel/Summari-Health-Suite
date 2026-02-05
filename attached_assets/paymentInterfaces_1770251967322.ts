import moment from "moment";

export interface PaymentModes {
  cuota1: boolean;
  cuota2: boolean;
  total: boolean;
};

export interface PaymentData {
  email: string;
  phoneNumber?: string;
  Pago_total: number;
  optional: object;
  modalidadPago: string;
  token?: string;
  Cuota?: string;
  commerceOrderID?: string;
  status?: string;
  fecha_pago?: string;
  "Fecha Emitido"?: string;
  Fecha_vencimiento?: moment.Moment;
};

export interface PaymentResult {
  token: string;
  commerceOrderID: string;
  url: string;
}

export interface PaymentValidationParams {
  fee: string;
  amount: number;
}