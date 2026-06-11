import { io, type Socket } from "socket.io-client";
import { wsUrl } from "./config";

let socket: Socket | null = null;
let activeToken = "";
let lifecycleBound = false;

type SocketLifecycleHandlers = {
  onConnect?: () => void;
  onDisconnect?: (reason: string) => void;
  onReconnect?: () => void;
};

let lifecycleHandlers: SocketLifecycleHandlers = {};

function bindSocketLifecycle(next: Socket) {
  if (lifecycleBound) return;
  lifecycleBound = true;
  next.on("connect", () => lifecycleHandlers.onConnect?.());
  next.on("disconnect", (reason) => lifecycleHandlers.onDisconnect?.(reason));
  next.io.on("reconnect", () => lifecycleHandlers.onReconnect?.());
}

export function setSocketLifecycleHandlers(handlers: SocketLifecycleHandlers) {
  lifecycleHandlers = handlers;
  if (socket) bindSocketLifecycle(socket);
}

export function connectRealtime(token: string) {
  if (socket && activeToken === token) return socket;
  socket?.disconnect();
  lifecycleBound = false;
  activeToken = token;
  socket = io(wsUrl(), {
    auth: { token },
    transports: ["websocket", "polling"],
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 8000
  });
  bindSocketLifecycle(socket);
  return socket;
}

export function getSocket() {
  return socket;
}

export function joinTenant(tenantId: string, token: string) {
  connectRealtime(token).emit("join", { tenantId });
}
