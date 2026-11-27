// frontend/src/context/ChatContext.jsx
import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from "react";
import { useAuth } from "./AuthContext";
import { api } from "../api/client";

const ChatContext = createContext(null);

export function ChatProvider({ children }) {
  const { user, token } = useAuth();
  const [connected, setConnected] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState(new Set());
  const [unreadMessagesCount, setUnreadMessagesCount] = useState(0);
  const [pendingRequestsCount, setPendingRequestsCount] = useState(0);

  // Active Chat Drawer state
  const [activeChatFriend, setActiveChatFriend] = useState(null);
  const [activeMessages, setActiveMessages] = useState([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [isPartnerTyping, setIsPartnerTyping] = useState(false);
  const [conversations, setConversations] = useState([]);

  const wsRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const activeChatFriendRef = useRef(activeChatFriend);

  useEffect(() => {
    activeChatFriendRef.current = activeChatFriend;
  }, [activeChatFriend]);

  // Refresh unread counts from API
  const refreshUnreadCounts = useCallback(async () => {
    if (!token) return;
    try {
      const [msgRes, reqRes] = await Promise.allSettled([
        api.getUnreadMessagesCount(),
        api.getFriendRequests(),
      ]);

      if (msgRes.status === "fulfilled" && typeof msgRes.value?.count === "number") {
        setUnreadMessagesCount(msgRes.value.count);
      }
      if (reqRes.status === "fulfilled" && Array.isArray(reqRes.value?.incoming)) {
        setPendingRequestsCount(reqRes.value.incoming.length);
      }
    } catch (err) {
      console.error("Failed to refresh unread counts:", err);
    }
  }, [token]);

  // Refresh conversations
  const refreshConversations = useCallback(async () => {
    if (!token) return;
    try {
      const data = await api.getConversations();
      setConversations(data || []);
    } catch (err) {
      console.error("Failed to load conversations:", err);
    }
  }, [token]);

  // WebSocket Connection Manager
  useEffect(() => {
    if (!token || !user) {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      setConnected(false);
      setOnlineUsers(new Set());
      return;
    }

    refreshUnreadCounts();
    refreshConversations();

    let isDisposed = false;

    function connectWebSocket() {
      if (isDisposed) return;

      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const host = window.location.host;
      const wsUrl = `${protocol}//${host}/ws?token=${encodeURIComponent(token)}`;

      try {
        const ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        ws.onopen = () => {
          if (isDisposed) {
            ws.close();
            return;
          }
          setConnected(true);
        };

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            handleWsEvent(data);
          } catch (err) {
            console.error("Failed to parse WS message:", err);
          }
        };

        ws.onclose = () => {
          setConnected(false);
          wsRef.current = null;
          if (!isDisposed) {
            // Reconnect with backoff
            reconnectTimeoutRef.current = setTimeout(connectWebSocket, 3000);
          }
        };

        ws.onerror = (err) => {
          console.warn("WebSocket connection error:", err);
          ws.close();
        };
      } catch (err) {
        console.error("Error creating WebSocket:", err);
        if (!isDisposed) {
          reconnectTimeoutRef.current = setTimeout(connectWebSocket, 3000);
        }
      }
    }

    connectWebSocket();

    return () => {
      isDisposed = true;
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [token, user, refreshUnreadCounts, refreshConversations]);

  // Handle incoming WS events
  const handleWsEvent = useCallback((data) => {
    if (!data || !data.type) return;

    switch (data.type) {
      case "new_message": {
        const msg = data.message;
        const currentFriend = activeChatFriendRef.current;

        if (currentFriend && msg.sender_id === currentFriend.id) {
          // Message belongs to currently open conversation
          setActiveMessages((prev) => {
            if (prev.some((m) => m.id === msg.id)) return prev;
            return [...prev, msg];
          });

          // Mark as read immediately
          if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({ type: "mark_read", sender_id: msg.sender_id }));
          } else {
            api.markMessagesRead(msg.sender_id).catch(() => {});
          }
        } else {
          // Increment unread count
          setUnreadMessagesCount((prev) => prev + 1);
        }

        // Update conversations
        setConversations((prev) => {
          const partnerId = msg.sender_id;
          const existing = prev.find((c) => c.friend.id === partnerId);
          if (existing) {
            return prev.map((c) => {
              if (c.friend.id === partnerId) {
                return {
                  ...c,
                  last_message: msg,
                  unread_count: currentFriend?.id === partnerId ? c.unread_count : c.unread_count + 1,
                };
              }
              return c;
            }).sort((a, b) => new Date(b.last_message?.created_at || 0) - new Date(a.last_message?.created_at || 0));
          } else {
            refreshConversations();
            return prev;
          }
        });
        break;
      }

      case "message_sent": {
        const msg = data.message;
        const currentFriend = activeChatFriendRef.current;
        if (currentFriend && msg.recipient_id === currentFriend.id) {
          setActiveMessages((prev) => {
            if (prev.some((m) => m.id === msg.id)) return prev;
            return [...prev, msg];
          });
        }
        refreshConversations();
        break;
      }

      case "messages_read": {
        const currentFriend = activeChatFriendRef.current;
        if (currentFriend && data.read_by === currentFriend.id) {
          setActiveMessages((prev) =>
            prev.map((m) => (!m.read_at ? { ...m, read_at: new Date().toISOString() } : m))
          );
        }
        break;
      }

      case "user_typing": {
        const currentFriend = activeChatFriendRef.current;
        if (currentFriend && data.sender_id === currentFriend.id) {
          setIsPartnerTyping(!!data.is_typing);
          if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
          if (data.is_typing) {
            typingTimeoutRef.current = setTimeout(() => {
              setIsPartnerTyping(false);
            }, 4000);
          }
        }
        break;
      }

      case "friend_presence": {
        const { user_id, status } = data;
        setOnlineUsers((prev) => {
          const next = new Set(prev);
          if (status === "online") {
            next.add(user_id);
          } else {
            next.delete(user_id);
          }
          return next;
        });

        // Also update conversations status
        setConversations((prev) =>
          prev.map((c) =>
            c.friend.id === user_id
              ? { ...c, friend: { ...c.friend, is_online: status === "online" } }
              : c
          )
        );
        break;
      }

      default:
        break;
    }
  }, [refreshConversations]);

  // Open Chat with a specific friend
  const openChatWithFriend = useCallback(async (friend) => {
    setActiveChatFriend(friend);
    setLoadingMessages(true);
    setIsPartnerTyping(false);

    try {
      const res = await api.getMessages(friend.id);
      setActiveMessages(res?.messages || []);

      // Decrement unread count by whatever this conversation had
      setConversations((prev) =>
        prev.map((c) => (c.friend.id === friend.id ? { ...c, unread_count: 0 } : c))
      );
      refreshUnreadCounts();
    } catch (err) {
      console.error("Failed to load chat messages:", err);
    } finally {
      setLoadingMessages(false);
    }
  }, [refreshUnreadCounts]);

  // Close chat drawer
  const closeChat = useCallback(() => {
    setActiveChatFriend(null);
    setActiveMessages([]);
    setIsPartnerTyping(false);
  }, []);

  // Send message
  const sendMessage = useCallback(async (recipientId, content) => {
    if (!content || !content.trim()) return;

    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: "send_message",
          recipient_id: recipientId,
          content: content.trim(),
        })
      );
    } else {
      // REST fallback
      const saved = await api.sendMessage(recipientId, content.trim());
      setActiveMessages((prev) => {
        if (prev.some((m) => m.id === saved.id)) return prev;
        return [...prev, saved];
      });
      refreshConversations();
    }
  }, [refreshConversations]);

  // Send typing indicator
  const sendTyping = useCallback((recipientId, isTyping) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: "typing",
          recipient_id: recipientId,
          is_typing: !!isTyping,
        })
      );
    }
  }, []);

  return (
    <ChatContext.Provider
      value={{
        connected,
        onlineUsers,
        unreadMessagesCount,
        pendingRequestsCount,
        refreshUnreadCounts,
        conversations,
        refreshConversations,
        activeChatFriend,
        activeMessages,
        loadingMessages,
        isPartnerTyping,
        openChatWithFriend,
        closeChat,
        sendMessage,
        sendTyping,
      }}
    >
      {children}
    </ChatContext.Provider>
  );
}

export function useChat() {
  const context = useContext(ChatContext);
  if (!context) {
    throw new Error("useChat must be used within a ChatProvider");
  }
  return context;
}
