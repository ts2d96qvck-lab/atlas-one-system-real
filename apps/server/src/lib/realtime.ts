import type { Server as HttpServer } from "node:http";
import { Server as SocketServer } from "socket.io";
import { resolveCorsOrigin } from "./cors";
import { resolveSessionUser } from "./session";

let io: SocketServer | null = null;

export function initRealtime(httpServer: HttpServer) {
  io = new SocketServer(httpServer, {
    cors: {
      origin: (origin, callback) => {
        resolveCorsOrigin(origin, (err, allow) => {
          if (err || !allow) callback(err ?? new Error("Origin nao permitida"), false);
          else callback(null, true);
        });
      },
      credentials: true
    }
  });

  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (typeof token !== "string" || !token.trim()) {
        return next(new Error("Nao autorizado"));
      }
      const user = await resolveSessionUser(token);
      if (!user) return next(new Error("Sessao invalida"));
      socket.data.user = user;
      next();
    } catch {
      next(new Error("Sessao invalida"));
    }
  });

  io.on("connection", (socket) => {
    socket.emit("atlas:ready", { ok: true });

    socket.on("join", (payload: { tenantId?: string }) => {
      const user = socket.data.user as { tenantId?: string } | undefined;
      if (payload?.tenantId && user?.tenantId === payload.tenantId) {
        socket.join(`tenant:${payload.tenantId}`);
      }
    });
  });

  return io;
}

export function emitToTenant(tenantId: string, event: string, payload: unknown) {
  io?.to(`tenant:${tenantId}`).emit(event, payload);
}
