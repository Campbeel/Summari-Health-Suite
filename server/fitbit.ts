import crypto from "crypto";

const FITBIT_AUTH_URL = "https://www.fitbit.com/oauth2/authorize";
const FITBIT_TOKEN_URL = "https://api.fitbit.com/oauth2/token";
const FITBIT_API_URL = "https://api.fitbit.com";

const FITBIT_SCOPES = "activity heartrate profile sleep weight temperature";

interface FitbitTokenResponse {
  access_token: string;
  expires_in: number;
  refresh_token: string;
  token_type: string;
  user_id: string;
  scope: string;
}

const pendingStates = new Map<string, { codeVerifier: string; patientId: number; userId: string }>();

function generateCodeVerifier(): string {
  return crypto.randomBytes(64).toString("base64url");
}

function generateCodeChallenge(verifier: string): string {
  return crypto.createHash("sha256").update(verifier).digest("base64url");
}

export function getFitbitAuthUrl(patientId: number, userId: string): string {
  const clientId = process.env.FITBIT_CLIENT_ID;
  if (!clientId) throw new Error("FITBIT_CLIENT_ID no está configurado");

  const baseUrl = process.env.BASE_URL || `https://${process.env.REPLIT_DEV_DOMAIN}`;
  const redirectUri = `${baseUrl}/api/fitbit/callback`;

  const codeVerifier = generateCodeVerifier();
  const codeChallenge = generateCodeChallenge(codeVerifier);
  const nonce = crypto.randomBytes(16).toString("hex");
  const sessionSecret = process.env.SESSION_SECRET || "fallback";
  const statePayload = `${nonce}:${patientId}:${userId}`;
  const hmac = crypto.createHmac("sha256", sessionSecret).update(statePayload).digest("hex");
  const state = `${statePayload}:${hmac}`;

  pendingStates.set(nonce, { codeVerifier, patientId, userId });
  setTimeout(() => pendingStates.delete(nonce), 10 * 60 * 1000);

  const params = new URLSearchParams({
    response_type: "code",
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: FITBIT_SCOPES,
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
    state,
  });

  return `${FITBIT_AUTH_URL}?${params.toString()}`;
}

export function getAndRemovePendingState(state: string) {
  const parts = state.split(":");
  if (parts.length < 4) return null;
  
  const receivedHmac = parts[parts.length - 1];
  const statePayload = parts.slice(0, -1).join(":");
  const sessionSecret = process.env.SESSION_SECRET || "fallback";
  const expectedHmac = crypto.createHmac("sha256", sessionSecret).update(statePayload).digest("hex");
  
  if (!crypto.timingSafeEqual(Buffer.from(receivedHmac, "hex"), Buffer.from(expectedHmac, "hex"))) {
    return null;
  }
  
  const nonce = parts[0];
  const data = pendingStates.get(nonce);
  if (data) pendingStates.delete(nonce);
  return data;
}

export async function exchangeCodeForTokens(code: string, codeVerifier: string): Promise<FitbitTokenResponse> {
  const clientId = process.env.FITBIT_CLIENT_ID!;
  const clientSecret = process.env.FITBIT_CLIENT_SECRET!;
  const baseUrl = process.env.BASE_URL || `https://${process.env.REPLIT_DEV_DOMAIN}`;
  const redirectUri = `${baseUrl}/api/fitbit/callback`;

  const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

  const body = new URLSearchParams({
    client_id: clientId,
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri,
    code_verifier: codeVerifier,
  });

  const response = await fetch(FITBIT_TOKEN_URL, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basicAuth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: body.toString(),
  });

  if (!response.ok) {
    const errText = await response.text();
    console.error("Fitbit token exchange error:", errText);
    throw new Error(`Fitbit token error: ${response.status}`);
  }

  return response.json() as Promise<FitbitTokenResponse>;
}

export async function refreshFitbitTokens(refreshToken: string): Promise<FitbitTokenResponse> {
  const clientId = process.env.FITBIT_CLIENT_ID!;
  const clientSecret = process.env.FITBIT_CLIENT_SECRET!;
  const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
  });

  const response = await fetch(FITBIT_TOKEN_URL, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basicAuth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: body.toString(),
  });

  if (!response.ok) {
    const errText = await response.text();
    console.error("Fitbit token refresh error:", errText);
    throw new Error(`Fitbit refresh error: ${response.status}`);
  }

  return response.json() as Promise<FitbitTokenResponse>;
}

async function fitbitGet(accessToken: string, path: string) {
  const response = await fetch(`${FITBIT_API_URL}${path}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Fitbit API error ${response.status}: ${errText}`);
  }

  return response.json();
}

interface SyncedMetric {
  metricType: string;
  value: string;
  unit: string;
  recordedAt: Date;
}

export async function fetchFitbitData(accessToken: string): Promise<SyncedMetric[]> {
  const today = new Date().toISOString().split("T")[0];
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
  const metrics: SyncedMetric[] = [];

  try {
    const stepsData = await fitbitGet(accessToken, `/1/user/-/activities/steps/date/${thirtyDaysAgo}/${today}.json`);
    if (stepsData["activities-steps"]) {
      for (const entry of stepsData["activities-steps"]) {
        if (parseInt(entry.value) > 0) {
          metrics.push({
            metricType: "steps",
            value: entry.value,
            unit: "pasos",
            recordedAt: new Date(entry.dateTime + "T23:59:00"),
          });
        }
      }
    }
  } catch (e) {
    console.error("Fitbit steps fetch error:", e);
  }

  try {
    const hrData = await fitbitGet(accessToken, `/1/user/-/activities/heart/date/${thirtyDaysAgo}/${today}.json`);
    if (hrData["activities-heart"]) {
      for (const entry of hrData["activities-heart"]) {
        const restingHR = entry.value?.restingHeartRate;
        if (restingHR) {
          metrics.push({
            metricType: "heart_rate",
            value: String(restingHR),
            unit: "bpm",
            recordedAt: new Date(entry.dateTime + "T12:00:00"),
          });
        }
      }
    }
  } catch (e) {
    console.error("Fitbit heart rate fetch error:", e);
  }

  try {
    const sleepData = await fitbitGet(accessToken, `/1.2/user/-/sleep/date/${thirtyDaysAgo}/${today}.json`);
    if (sleepData.sleep) {
      for (const entry of sleepData.sleep) {
        if (entry.isMainSleep && entry.duration) {
          const hours = (entry.duration / 3600000).toFixed(1);
          metrics.push({
            metricType: "sleep_duration",
            value: hours,
            unit: "horas",
            recordedAt: new Date(entry.dateOfSleep + "T08:00:00"),
          });
        }
      }
    }
  } catch (e) {
    console.error("Fitbit sleep fetch error:", e);
  }

  try {
    const weightData = await fitbitGet(accessToken, `/1/user/-/body/weight/date/${thirtyDaysAgo}/${today}.json`);
    if (weightData["body-weight"]) {
      for (const entry of weightData["body-weight"]) {
        if (parseFloat(entry.value) > 0) {
          metrics.push({
            metricType: "weight",
            value: entry.value,
            unit: "kg",
            recordedAt: new Date(entry.dateTime + "T12:00:00"),
          });
        }
      }
    }
  } catch (e) {
    console.error("Fitbit weight fetch error:", e);
  }

  try {
    const caloriesData = await fitbitGet(accessToken, `/1/user/-/activities/calories/date/${thirtyDaysAgo}/${today}.json`);
    if (caloriesData["activities-calories"]) {
      for (const entry of caloriesData["activities-calories"]) {
        if (parseInt(entry.value) > 0) {
          metrics.push({
            metricType: "calories",
            value: entry.value,
            unit: "kcal",
            recordedAt: new Date(entry.dateTime + "T23:59:00"),
          });
        }
      }
    }
  } catch (e) {
    console.error("Fitbit calories fetch error:", e);
  }

  try {
    const spo2Data = await fitbitGet(accessToken, `/1/user/-/spo2/date/${thirtyDaysAgo}/${today}.json`);
    if (Array.isArray(spo2Data) && spo2Data.length > 0) {
      for (const entry of spo2Data) {
        if (entry.value?.avg) {
          metrics.push({
            metricType: "spo2",
            value: String(entry.value.avg),
            unit: "%",
            recordedAt: new Date(entry.dateTime + "T12:00:00"),
          });
        }
      }
    }
  } catch (e: any) {
    // Solo loguear si no es un error de permisos, para no saturar logs
    if (!e.message?.includes("403")) {
      console.error("Fitbit SpO2 fetch error:", e);
    }
  }

  try {
    const tempData = await fitbitGet(accessToken, `/1/user/-/temp/skin/date/${thirtyDaysAgo}/${today}.json`);
    if (tempData.tempSkin) {
      for (const entry of tempData.tempSkin) {
        if (entry.value?.nightlyRelative !== undefined) {
          const baseTemp = 36.5;
          const actualTemp = (baseTemp + entry.value.nightlyRelative).toFixed(1);
          metrics.push({
            metricType: "temperature",
            value: actualTemp,
            unit: "°C",
            recordedAt: new Date(entry.dateTime + "T06:00:00"),
          });
        }
      }
    }
  } catch (e: any) {
    if (!e.message?.includes("403")) {
      console.error("Fitbit temperature fetch error:", e);
    }
  }

  return metrics;
}
