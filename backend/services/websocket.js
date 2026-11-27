// backend/services/websocket.js
import { WebSocketServer, WebSocket } from "ws";
import jwt from "jsonwebtoken";
import { db } from "../db/connection.js";

const JWT_SECRET = process.env.JWT_SECRET || "dev_secret";

// In-memory mapping: userId -> Set of connected WebSocket clients
const userSockets = new Map();

/**
 * Send JSON event to all connected sockets of a user
 */
export function sendToUser(userId, data) {
  const sockets = userSockets.get(userId);
  if (!sockets || sockets.size === 0) return false;
  const payload = JSON.stringify(data);
  for (const ws of sockets) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(payload);
    }
  }
  return true;
}

/**
 * Check if a user has at least one active socket connection
 */
export function isUserOnline(userId) {
  const sockets = userSockets.get(userId);
  return !!sockets && sockets.size > 0;
}

/**
 * Return array of all currently online user IDs
 */
export function getOnlineUserIds() {
  return Array.from(userSockets.keys());
}

/**
 * Notify online friends of presence change (online / offline)
 */
async function broadcastPresence(userId, status) {
  try {
    const userFriends = await db("friends")
      .where({ user_id: userId })
      .select("friend_id");

    for (const f of userFriends) {
      sendToUser(f.friend_id, {
        type: "friend_presence",
        user_id: userId,
        status, // "online" or "offline"
      });
    }
  } catch (err) {
    console.error("Error broadcasting presence:", err);
  }
}

/**
 * Initialize WebSocket Server and attach to HTTP Server
 */
export function initWebSocketServer(httpServer) {
  const wss = new WebSocketServer({ noServer: true });

  httpServer.on("upgrade", (req, socket, head) => {
    try {
      const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
      if (url.pathname !== "/ws") {
        return; // Let other handlers (if any) handle non-/ws upgrades
      }

      const token = url.searchParams.get("token");
      if (!token) {
        socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
        socket.destroy();
        return;
      }

      jwt.verify(token, JWT_SECRET, (err, decoded) => {
        if (err || !decoded || !decoded.id) {
          socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
          socket.destroy();
          return;
        }

        wss.handleUpgrade(req, socket, head, (ws) => {
          wss.emit("connection", ws, req, decoded);
        });
      });
    } catch (err) {
      console.error("WebSocket upgrade error:", err);
      socket.destroy();
    }
  });

  wss.on("connection", async (ws, req, decoded) => {
    ws.userId = decoded.id;
    ws.isAlive = true;

    if (!userSockets.has(ws.userId)) {
      userSockets.set(ws.userId, new Set());
    }
    userSockets.get(ws.userId).add(ws);

    // Broadcast online presence if this is their first active socket
    if (userSockets.get(ws.userId).size === 1) {
      broadcastPresence(ws.userId, "online");
    }

    ws.on("pong", () => {
      ws.isAlive = true;
    });

    ws.on("message", async (rawMessage) => {
      try {
        const data = JSON.parse(rawMessage.toString());
        if (!data || !data.type) return;

        if (data.type === "send_message") {
          const { recipient_id, content } = data;
          if (!recipient_id || !content || typeof content !== "string" || !content.trim()) {
            ws.send(JSON.stringify({ type: "error", error: "Message content is required" }));
            return;
          }
          if (content.length > 2000) {
            ws.send(JSON.stringify({ type: "error", error: "Message exceeds 2000 characters limit" }));
            return;
          }
          if (recipient_id === ws.userId) {
            ws.send(JSON.stringify({ type: "error", error: "Cannot send message to yourself" }));
            return;
          }

          // Verify neither user has blocked the other
          const isBlocked = await db("blocked_users")
            .where(function () {
              this.where({ user_id: ws.userId, blocked_id: recipient_id })
                .orWhere({ user_id: recipient_id, blocked_id: ws.userId });
            })
            .first();

          if (isBlocked) {
            ws.send(JSON.stringify({ type: "error", error: "Cannot message this user" }));
            return;
          }

          // Verify mutual friendship exists
          const friendship = await db("friends")
            .where({ user_id: ws.userId, friend_id: recipient_id })
            .first();

          if (!friendship) {
            ws.send(JSON.stringify({ type: "error", error: "You can only message friends" }));
            return;
          }

          // Insert into direct_messages
          const [inserted] = await db("direct_messages")
            .insert({
              sender_id: ws.userId,
              recipient_id,
              content: content.trim(),
            })
            .returning("*");

          const saved = typeof inserted === "object" && inserted !== null
            ? inserted
            : await db("direct_messages").where({ id: inserted }).first();

          // Acknowledge to sender
          sendToUser(ws.userId, {
            type: "message_sent",
            message: saved,
          });

          // Deliver to recipient
          sendToUser(recipient_id, {
            type: "new_message",
            message: saved,
          });
        } else if (data.type === "mark_read") {
          const { sender_id } = data;
          if (!sender_id) return;

          await db("direct_messages")
            .where({ sender_id, recipient_id: ws.userId })
            .whereNull("read_at")
            .update({ read_at: db.fn.now() });

          sendToUser(sender_id, {
            type: "messages_read",
            read_by: ws.userId,
          });
        } else if (data.type === "typing") {
          const { recipient_id, is_typing } = data;
          if (!recipient_id) return;

          sendToUser(recipient_id, {
            type: "user_typing",
            sender_id: ws.userId,
            is_typing: !!is_typing,
          });
        }
      } catch (err) {
        console.error("WebSocket message handling error:", err);
      }
    });

    ws.on("close", () => {
      const userSet = userSockets.get(ws.userId);
      if (userSet) {
        userSet.delete(ws);
        if (userSet.size === 0) {
          userSockets.delete(ws.userId);
          broadcastPresence(ws.userId, "offline");
        }
      }
    });

    ws.on("error", (err) => {
      console.warn("WebSocket client error:", err.message);
    });
  });

  // Heartbeat ping interval
  const pingInterval = setInterval(() => {
    wss.clients.forEach((ws) => {
      if (ws.isAlive === false) {
        return ws.terminate();
      }
      ws.isAlive = false;
      ws.ping();
    });
  }, 30000);

  wss.on("close", () => {
    clearInterval(pingInterval);
  });

  return wss;
}
