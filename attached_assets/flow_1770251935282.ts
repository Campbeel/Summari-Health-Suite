import axios from 'axios';
import { randomUUID } from 'crypto';
import queryString from 'query-string';
import dotenv from 'dotenv';
dotenv.config();



// https://www.flow.cl/docs/api.html#tag/payment/paths/~1payment~1create/post
interface CreatePaymentParams {
  apiKey: string;
  commerceOrder: string;
  subject: string;
  currency?: string;
  amount: number;
  email: string;
  paymentMethod?: number;
  urlConfirmation: string;
  urlReturn: string;
  optional?: string;
  timeout?: number;
  merchantID?: string;
  payment_currency?: string;
}

interface CreatePaymentResponse {
  token: string;
  url: string;
  flowOrder: number;
}

type Signed<T> = T & { s: string };

export async function withSignature(
  params: Record<string, any>
): Promise<Signed<Record<string, any>>> {
  const subtleCrypto = crypto.subtle;
  const enc = new TextEncoder();
  const algorithm = { name: 'HMAC', hash: 'SHA-256' };

  const key = await subtleCrypto.importKey(
    'raw',
    enc.encode(process.env.FLOW_SECRET!),
    algorithm,
    false,
    ['sign', 'verify']
  );

  const body = Object.entries(params)
    .sort(([a], [b]) => a.localeCompare(b))
    .reduce((res, [key, value]) => res + `${key}${value}`, '');

  const signature = await subtleCrypto.sign(
    algorithm.name,
    key,
    enc.encode(body)
  );

  // convert buffer to hex string
  const s = Array.from(new Uint8Array(signature), (b) =>
    b.toString(16).padStart(2, '0')
  ).join('');

  return { ...params, s };
}

export async function createPayment(
  email: string,
  amount: number = 490,
  optional: object = {}
) {
  const createPaymentUrl = `${process.env.FLOW_BASE_URL!}/payment/create`;
  const commerceOrderID = randomUUID();
  const params: CreatePaymentParams = {
    apiKey: process.env.FLOW_KEY!,
    commerceOrder: commerceOrderID,
    subject: 'Pago permiso de circulación Alhué',
    currency: 'CLP',
    amount,
    email,
    urlConfirmation: `${process.env.BASE_URL!}/api/payment/confirm`,
    urlReturn: `${process.env.BASE_URL!}/pagoCompletado?token=${commerceOrderID}`,
    optional: JSON.stringify(optional),
  };

  const signedParams = await withSignature(params);
  const postData = queryString.stringify(signedParams);

  const response = (
    await axios.post(createPaymentUrl, postData, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    })
  ).data as CreatePaymentResponse;
  return { token: response.token, url: response.url, commerceOrderID };
}

export async function getPaymentStatus(token: string) {
  const validateUrl = `${process.env.FLOW_BASE_URL!}/payment/getStatus`;

  // Prepare parameters to verify the payment
  const params = {
    apiKey: process.env.FLOW_KEY!,
    token,
  };

  // Generate signature to match Flow's requirements
  const signedParams = await withSignature(params);

  // Prepare the data to be sent
  const postData = '?' + queryString.stringify(signedParams);
  const response = await axios.get(validateUrl + postData);

  return response.data;
}