import { createPayment, getPaymentStatus } from "../../lib/flow";
import { DEADLINE, MAX_DEADLINE, getCurrentDate } from "../constants"
import { PaymentData, PaymentResult } from "../objects/paymentInterfaces";
import {  updatePaymentData, updatePaymentDataByToken, getPaymentInitiation, 
          getFineById, updateFineToPaid, addPaidFine, addPayment } from "../db";
import { MissingToken, FailedPaymentConfirmation } from "../objects/errorHandler";

export function buildPaymentData(body: any): PaymentData {
  return {
    email: body.email,
    phoneNumber: body.phoneNumber,
    Pago_total: body.amount,
    optional: body.optional,
    modalidadPago: body.modalidad_pago
  };
}

export async function handlePaymentCreation(paymentID: string, paymentData: PaymentData) : Promise<string> {
    const paymentResult = await getPaymentResult(paymentData);
    await updatePaymentInDB(paymentID, paymentData, paymentResult)
    return buildRedirectURL(paymentResult);
}

async function getPaymentResult(paymentData: PaymentData) : Promise<PaymentResult> {
  return await createPayment(
    paymentData.email,
    paymentData.Pago_total,
    paymentData.optional
  );
}

async function updatePaymentInDB(paymentId: string, paymentData: PaymentData, paymentResult: PaymentResult) : Promise<void> {
  await updatePaymentData(paymentId, {
    ...paymentData,
    token: paymentResult.token,
    commerceOrderID: paymentResult.commerceOrderID
  });
}

function buildRedirectURL(paymentResult: PaymentResult) : string {
  return `${paymentResult.url}?token=${paymentResult.token}`;
}

export async function confirmPayment (token: any) : Promise<void>  {
  if (!token) throw new MissingToken();
  const paymentStatus = await getPaymentStatus(token);
  const paymentInitiation = await getPaymentInitiation(token, "token");

  if (wasPaymentSuccessful(paymentStatus.status)) 
    await handleSuccessfulPayment(token, paymentStatus.commerceOrder, paymentInitiation);
  else
    await handleFailedPayment(token, paymentInitiation);
};

function wasPaymentSuccessful(status: number) : boolean {
  return status === 2;
}

async function handleSuccessfulPayment (token: any, commerceOrder: string, payment: any) : Promise<void>  {  
  if (payment?.REQ_multas) {
    await processUnpaidFines(payment);
  }

  if (payment){
    await updatePaymentDeadline(token, commerceOrder, payment);
    await addPayment(payment);
  }
};

async function processUnpaidFines(payment: any) : Promise<void> {
  for (const fine of payment.REQ_multas){
    const fineData = await getFineById(fine);
    if (fineData?.estado !== "PAGADA"){
      updateFineToPaid(fine);
      addPaidFine(fineData, payment.Patente);
    }
  }
}

async function updatePaymentDeadline(token: string, commerceOrder: string, payment: any) {
  payment.status = "1";
  payment.fecha_pago = getCurrentDate();
  payment["Fecha Emitido"] = getCurrentDate();
  payment.commerceOrder = commerceOrder;
  payment.Fecha_vencimiento = await getExpirationDate(payment.Cuota);
  await updatePaymentDataByToken(token, payment);
}

async function getExpirationDate(fee: any) : Promise<string>{
  return fee?.toLowerCase() === "cuota 1" 
    ? DEADLINE.format("DD-MM-YY")
    : MAX_DEADLINE.format("DD-MM-YY");
}

async function handleFailedPayment(token: string, payment: any) {
  await updatePaymentDataByToken(token, {
    ...payment,
    status: "0",
    fecha_pago: getCurrentDate()
  });
  throw new FailedPaymentConfirmation();
}
