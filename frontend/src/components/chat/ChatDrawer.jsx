// frontend/src/components/chat/ChatDrawer.jsx
import React, { useState, useEffect, useRef } from "react";
import {
  XMarkIcon,
  PaperAirplaneIcon,
  ChatBubbleLeftRightIcon,
  CheckIcon,
  ArrowsRightLeftIcon,
  UserCircleIcon,
} from "@heroicons/react/24/solid";
import { useChat } from "../../context/ChatContext";
import { useAuth } from "../../context/AuthContext";

export default function ChatDrawer() {
  const { user } = useAuth();
  const {
    activeChatFriend,
    activeMessages,
    loadingMessages,
    isPartnerTyping,
    closeChat,
    sendMessage,
    sendTyping,
    onlineUsers,
  } = useChat();

  const [inputContent, setInputContent] = useState("");
  const messagesEndRef = useRef(null);
  const typingTimerRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [activeMessages, isPartnerTyping]);

  if (!activeChatFriend) return null;

  const isOnline = onlineUsers.has(activeChatFriend.id) || activeChatFriend.is_online;

  const handleInputChange = (e) => {
    const val = e.target.value;
    setInputContent(val);

    // Broadcast typing state
    sendTyping(activeChatFriend.id, true);
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    typingTimerRef.current = setTimeout(() => {
      sendTyping(activeChatFriend.id, false);
    }, 2000);
  };

  const handleSend = async (e) => {
    e?.preventDefault();
    const trimmed = inputContent.trim();
    if (!trimmed) return;

    setInputContent("");
    sendTyping(activeChatFriend.id, false);
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);

    await sendMessage(activeChatFriend.id, trimmed);
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const formatTime = (isoString) => {
    if (!isoString) return "";
    try {
      const date = new Date(isoString);
      return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
    } catch {
      return "";
    }
  };

  return (
    <div
      style={{
        position: "fixed",
        bottom: "1rem",
        right: "1.5rem",
        width: "380px",
        maxWidth: "calc(100vw - 2rem)",
        height: "540px",
        maxHeight: "calc(100vh - 5rem)",
        backgroundColor: "#0f172a",
        border: "1px solid #334155",
        borderRadius: "12px",
        boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.5), 0 8px 10px -6px rgba(0, 0, 0, 0.5)",
        display: "flex",
        flexDirection: "column",
        zIndex: 9999,
        overflow: "hidden",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0.85rem 1rem",
          backgroundColor: "#1e293b",
          borderBottom: "1px solid #334155",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", minWidth: 0 }}>
          <div style={{ position: "relative", flexShrink: 0 }}>
            {activeChatFriend.avatar_url ? (
              <img
                src={activeChatFriend.avatar_url}
                alt={activeChatFriend.username}
                style={{ width: "38px", height: "38px", borderRadius: "50%", objectFit: "cover" }}
              />
            ) : (
              <UserCircleIcon style={{ width: "38px", height: "38px", color: "#64748b" }} />
            )}
            <span
              style={{
                position: "absolute",
                bottom: "0",
                right: "0",
                width: "10px",
                height: "10px",
                borderRadius: "50%",
                backgroundColor: isOnline ? "#10b981" : "#64748b",
                border: "2px solid #1e293b",
              }}
              title={isOnline ? "Online" : "Offline"}
            />
          </div>

          <div style={{ minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <span
                style={{
                  fontWeight: 600,
                  color: "#f8fafc",
                  fontSize: "0.95rem",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {activeChatFriend.username}
              </span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", fontSize: "0.75rem", color: "#94a3b8" }}>
              <span>{isOnline ? "Online" : "Offline"}</span>
              <span>&bull;</span>
              <span style={{ display: "flex", alignItems: "center", gap: "2px", color: "#38bdf8" }}>
                <ArrowsRightLeftIcon style={{ width: "12px", height: "12px" }} /> Trading DM
              </span>
            </div>
          </div>
        </div>

        <button
          onClick={closeChat}
          style={{
            background: "transparent",
            border: "none",
            color: "#94a3b8",
            cursor: "pointer",
            padding: "4px",
            borderRadius: "6px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
          title="Close chat"
          onMouseOver={(e) => (e.currentTarget.style.color = "#f8fafc")}
          onMouseOut={(e) => (e.currentTarget.style.color = "#94a3b8")}
        >
          <XMarkIcon style={{ width: "20px", height: "20px" }} />
        </button>
      </div>

      {/* Messages Stream */}
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "1rem",
          display: "flex",
          flexDirection: "column",
          gap: "0.75rem",
          backgroundColor: "#090d16",
        }}
      >
        {loadingMessages ? (
          <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100%", color: "#64748b", fontSize: "0.85rem" }}>
            Loading conversation...
          </div>
        ) : activeMessages.length === 0 ? (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              height: "100%",
              textAlign: "center",
              color: "#64748b",
              gap: "0.5rem",
            }}
          >
            <ChatBubbleLeftRightIcon style={{ width: "36px", height: "36px", opacity: 0.5 }} />
            <span style={{ fontSize: "0.9rem", color: "#94a3b8" }}>No messages yet</span>
            <span style={{ fontSize: "0.78rem" }}>Coordinate trades and negotiate cards in real time.</span>
          </div>
        ) : (
          activeMessages.map((msg) => {
            const isMe = msg.sender_id === user?.id;
            return (
              <div
                key={msg.id}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: isMe ? "flex-end" : "flex-start",
                  maxWidth: "85%",
                  alignSelf: isMe ? "flex-end" : "flex-start",
                }}
              >
                <div
                  style={{
                    backgroundColor: isMe ? "#4f46e5" : "#1e293b",
                    color: isMe ? "#ffffff" : "#f1f5f9",
                    padding: "0.6rem 0.85rem",
                    borderRadius: isMe ? "12px 12px 2px 12px" : "12px 12px 12px 2px",
                    fontSize: "0.88rem",
                    lineHeight: "1.4",
                    wordBreak: "break-word",
                    whiteSpace: "pre-wrap",
                  }}
                >
                  {msg.content}
                </div>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "4px",
                    fontSize: "0.7rem",
                    color: "#64748b",
                    marginTop: "3px",
                    paddingLeft: "4px",
                    paddingRight: "4px",
                  }}
                >
                  <span>{formatTime(msg.created_at)}</span>
                  {isMe && (
                    <span title={msg.read_at ? "Read" : "Sent"} style={{ display: "inline-flex", alignItems: "center" }}>
                      <CheckIcon
                        style={{
                          width: "12px",
                          height: "12px",
                          color: msg.read_at ? "#38bdf8" : "#94a3b8",
                        }}
                      />
                    </span>
                  )}
                </div>
              </div>
            );
          })
        )}

        {isPartnerTyping && (
          <div
            style={{
              alignSelf: "flex-start",
              backgroundColor: "#1e293b",
              color: "#94a3b8",
              padding: "0.4rem 0.75rem",
              borderRadius: "12px 12px 12px 2px",
              fontSize: "0.78rem",
              fontStyle: "italic",
            }}
          >
            {activeChatFriend.username} is typing...
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Footer */}
      <form
        onSubmit={handleSend}
        style={{
          display: "flex",
          alignItems: "center",
          gap: "0.5rem",
          padding: "0.75rem",
          backgroundColor: "#1e293b",
          borderTop: "1px solid #334155",
        }}
      >
        <input
          type="text"
          value={inputContent}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          placeholder={`Message ${activeChatFriend.username}...`}
          maxLength={2000}
          style={{
            flex: 1,
            backgroundColor: "#0f172a",
            color: "#f8fafc",
            border: "1px solid #475569",
            borderRadius: "8px",
            padding: "0.55rem 0.75rem",
            fontSize: "0.88rem",
            outline: "none",
          }}
          onFocus={(e) => (e.currentTarget.style.borderColor = "#6366f1")}
          onBlur={(e) => (e.currentTarget.style.borderColor = "#475569")}
        />
        <button
          type="submit"
          disabled={!inputContent.trim()}
          style={{
            backgroundColor: inputContent.trim() ? "#6366f1" : "#334155",
            color: inputContent.trim() ? "#ffffff" : "#64748b",
            border: "none",
            borderRadius: "8px",
            padding: "0.55rem 0.85rem",
            cursor: inputContent.trim() ? "pointer" : "not-allowed",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            transition: "background-color 0.15s ease",
          }}
          title="Send message"
        >
          <PaperAirplaneIcon style={{ width: "16px", height: "16px" }} />
        </button>
      </form>
    </div>
  );
}
