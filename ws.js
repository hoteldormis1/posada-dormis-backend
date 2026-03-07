// ws.js – WebSocket server singleton
import { WebSocketServer } from "ws";

/** @type {WebSocketServer | null} */
let wss = null;

/**
 * Inicializa el WebSocket server sobre un http.Server existente.
 * @param {import("http").Server} httpServer
 */
export function initWss(httpServer) {
  wss = new WebSocketServer({ server: httpServer });

  wss.on("connection", (ws, req) => {
    ws.on("error", (err) => console.error("[WS] error de cliente:", err.message));
    ws.send(JSON.stringify({ event: "connected", ts: Date.now() }));
  });

  console.log("🔌 WebSocket server iniciado");
}

/**
 * Emite un evento JSON a todos los clientes conectados.
 * @param {string} event - Nombre del evento
 * @param {Record<string, unknown>} [data={}] - Payload
 */
export function broadcast(event, data = {}) {
  if (!wss) return;
  const msg = JSON.stringify({ event, data, ts: Date.now() });
  for (const client of wss.clients) {
    if (client.readyState === 1 /* OPEN */) {
      client.send(msg);
    }
  }
}
