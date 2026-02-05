import { randomUUID } from 'crypto';

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

  const secretKey = process.env.FLOW_SECRET;
  if (!secretKey) {
    throw new Error('FLOW_SECRET environment variable is not set');
  }

  const key = await subtleCrypto.importKey(
    'raw',
    enc.encode(secretKey),
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

  const s = Array.from(new Uint8Array(signature), (b) =>
    b.toString(16).padStart(2, '0')
  ).join('');

  return { ...params, s };
}

function objectToFormUrlEncoded(obj: Record<string, any>): string {
  return Object.entries(obj)
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
    .join('&');
}

export async function createPayment(
  email: string,
  amount: number,
  appointmentId: number,
  subject: string = 'Pago de consulta médica - Summari'
): Promise<{ token: string; url: string; commerceOrderID: string }> {
  const flowBaseUrl = process.env.FLOW_BASE_URL;
  const flowKey = process.env.FLOW_KEY;
  const baseUrl = process.env.BASE_URL || `https://${process.env.REPL_SLUG}.${process.env.REPLIT_DEV_DOMAIN}`;

  if (!flowBaseUrl || !flowKey) {
    throw new Error('Flow environment variables (FLOW_BASE_URL, FLOW_KEY) are not set');
  }

  const createPaymentUrl = `${flowBaseUrl}/payment/create`;
  const commerceOrderID = randomUUID();

  const params: CreatePaymentParams = {
    apiKey: flowKey,
    commerceOrder: commerceOrderID,
    subject,
    currency: 'CLP',
    amount,
    email,
    urlConfirmation: `${baseUrl}/api/flow/confirm`,
    urlReturn: `${baseUrl}/payment/result?commerceOrder=${commerceOrderID}`,
    optional: JSON.stringify({ appointmentId }),
  };

  const signedParams = await withSignature(params);
  const postData = objectToFormUrlEncoded(signedParams);

  const response = await fetch(createPaymentUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: postData,
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Flow API error:', errorText);
    throw new Error(`Flow API error: ${response.status} - ${errorText}`);
  }

  const data = await response.json() as CreatePaymentResponse;
  return { 
    token: data.token, 
    url: data.url, 
    commerceOrderID 
  };
}

export async function getPaymentStatus(token: string): Promise<{
  flowOrder: number;
  commerceOrder: string;
  requestDate: string;
  status: number;
  subject: string;
  currency: string;
  amount: number;
  payer: string;
  optional: string;
  pending_info?: {
    media: string;
    date: string;
  };
  paymentData?: {
    date: string;
    media: string;
    conversionDate?: string;
    conversionRate?: number;
    amount: number;
    currency: string;
    fee: number;
    balance: number;
    transferDate?: string;
  };
  merchantId?: string;
}> {
  const flowBaseUrl = process.env.FLOW_BASE_URL;
  const flowKey = process.env.FLOW_KEY;

  if (!flowBaseUrl || !flowKey) {
    throw new Error('Flow environment variables (FLOW_BASE_URL, FLOW_KEY) are not set');
  }

  const validateUrl = `${flowBaseUrl}/payment/getStatus`;

  const params = {
    apiKey: flowKey,
    token,
  };

  const signedParams = await withSignature(params);
  const queryString = objectToFormUrlEncoded(signedParams);

  const response = await fetch(`${validateUrl}?${queryString}`);

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Flow API error:', errorText);
    throw new Error(`Flow API error: ${response.status} - ${errorText}`);
  }

  return response.json();
}

export function isPaymentSuccessful(status: number): boolean {
  return status === 2;
}

export function getPaymentStatusText(status: number): string {
  switch (status) {
    case 1:
      return 'pending';
    case 2:
      return 'paid';
    case 3:
      return 'rejected';
    case 4:
      return 'cancelled';
    default:
      return 'unknown';
  }
}
