import { storage } from "./storage";
import { fetchFitbitData, refreshFitbitTokens } from "./fitbit";
import type { WearableConnection } from "@shared/schema";

function log(message: string) {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });
  console.log(`${formattedTime} [fitbit-sync] ${message}`);
}

const SYNC_INTERVAL_MS = 60 * 60 * 1000;

async function syncPatientFitbit(connection: WearableConnection): Promise<{ patientId: number; synced: number; error?: string }> {
  const patientId = connection.patientId;

  try {
    let accessToken = connection.accessToken;

    if (connection.tokenExpiresAt && new Date(connection.tokenExpiresAt) <= new Date()) {
      if (!connection.refreshToken) {
        await storage.updateWearableConnection(connection.id, { isActive: false });
        return { patientId, synced: 0, error: "Token expirado sin refresh token" };
      }
      try {
        const newTokens = await refreshFitbitTokens(connection.refreshToken);
        accessToken = newTokens.access_token;
        await storage.updateWearableConnection(connection.id, {
          accessToken: newTokens.access_token,
          refreshToken: newTokens.refresh_token,
          tokenExpiresAt: new Date(Date.now() + newTokens.expires_in * 1000),
        });
      } catch (refreshErr: any) {
        if (refreshErr.message?.includes("invalid_grant") || refreshErr.message?.includes("401")) {
          await storage.updateWearableConnection(connection.id, { isActive: false });
          return { patientId, synced: 0, error: "Refresh token inválido, conexión desactivada" };
        }
        throw refreshErr;
      }
    }

    const fitbitMetrics = await fetchFitbitData(accessToken);
    let syncedCount = 0;

    for (const m of fitbitMetrics) {
      const existing = await storage.getWearableMetrics(patientId, {
        metricType: m.metricType,
        from: new Date(new Date(m.recordedAt).getTime() - 60000).toISOString(),
        to: new Date(new Date(m.recordedAt).getTime() + 60000).toISOString(),
      });

      if (existing.length === 0) {
        await storage.createWearableMetrics([{
          patientId,
          metricType: m.metricType,
          value: m.value,
          unit: m.unit,
          recordedAt: m.recordedAt,
          source: "fitbit",
          deviceName: "Fitbit",
        }]);
        syncedCount++;
      }
    }

    await storage.updateWearableConnection(connection.id, {
      lastSyncAt: new Date(),
    });

    return { patientId, synced: syncedCount };
  } catch (err: any) {
    return { patientId, synced: 0, error: err.message };
  }
}

async function runAutoSync() {
  try {
    const connections = await storage.getAllActiveWearableConnections("fitbit");

    if (connections.length === 0) {
      log("No hay conexiones Fitbit activas para sincronizar");
      return;
    }

    log(`Sincronización automática: ${connections.length} conexión(es) activa(s)`);

    for (const conn of connections) {
      const result = await syncPatientFitbit(conn);
      if (result.error) {
        log(`Paciente ${result.patientId}: error - ${result.error}`);
      } else if (result.synced > 0) {
        log(`Paciente ${result.patientId}: ${result.synced} métricas nuevas`);
      }
    }
  } catch (err: any) {
    log(`Error en sincronización automática: ${err.message}`);
  }
}

let syncTimer: ReturnType<typeof setInterval> | null = null;

export function startFitbitAutoSync() {
  if (syncTimer) return;

  log(`Sincronización automática de Fitbit iniciada (cada ${SYNC_INTERVAL_MS / 60000} minutos)`);

  setTimeout(() => runAutoSync(), 30000);

  syncTimer = setInterval(runAutoSync, SYNC_INTERVAL_MS);
}

export function stopFitbitAutoSync() {
  if (syncTimer) {
    clearInterval(syncTimer);
    syncTimer = null;
    log("Sincronización automática de Fitbit detenida");
  }
}
