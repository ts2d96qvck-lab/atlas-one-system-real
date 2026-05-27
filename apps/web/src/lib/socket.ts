import { io, type Socket } from "socket.io-client";
import { wsUrl } from "./config";

let socket: Socket | null = null;
let activeToken = "";

export function connectRealtime(token: string) {
  if (socket && activeToken === token) return socket;
  socket?.disconnect();
  activeToken = token;
  socket = io(wsUrl(), {
    auth: { token },
    transports: ["websocket", "polling"]
  });
  return socket;
}

export function getSocket() {
  return socket;
}

export function joinTenant(tenantId: string, token: string) {
  connectRealtime(token).emit("join", { tenantId });
}
