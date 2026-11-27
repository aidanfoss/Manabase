// frontend/src/pages/FriendsPage.jsx
import React, { useState, useEffect, useCallback } from "react";
import {
  UserGroupIcon,
  UserPlusIcon,
  ChatBubbleLeftRightIcon,
  NoSymbolIcon,
  Cog6ToothIcon,
  ArrowsRightLeftIcon,
  PrinterIcon,
  CheckIcon,
  XMarkIcon,
  MagnifyingGlassIcon,
  PaperAirplaneIcon,
  UserCircleIcon,
  ArrowPathIcon,
  CheckCircleIcon,
  ShieldCheckIcon,
} from "@heroicons/react/24/solid";
import { api } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { useChat } from "../context/ChatContext";
import { useToast } from "../context/ToastContext";
import FriendSettingsModal from "../components/friends/FriendSettingsModal";
import "../styles/tabs.css";

export default function FriendsPage() {
  const { user } = useAuth();
  const {
    openChatWithFriend,
    onlineUsers,
    unreadMessagesCount,
    pendingRequestsCount,
    refreshUnreadCounts,
    conversations,
    refreshConversations,
  } = useChat();
  const { showToast } = useToast();

  const [activeTab, setActiveTab] = useState("friends"); // "friends", "requests", "messages", "blocked"

  // Friends state
  const [friends, setFriends] = useState([]);
  const [loadingFriends, setLoadingFriends] = useState(false);
  const [friendSearchQuery, setFriendSearchQuery] = useState("");
  const [selectedFriendForSettings, setSelectedFriendForSettings] = useState(null);

  // Requests state
  const [incomingRequests, setIncomingRequests] = useState([]);
  const [outgoingRequests, setOutgoingRequests] = useState([]);
  const [loadingRequests, setLoadingRequests] = useState(false);
  const [searchUsersQuery, setSearchUsersQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searchingUsers, setSearchingUsers] = useState(false);

  // Blocked state
  const [blockedUsers, setBlockedUsers] = useState([]);
  const [loadingBlocked, setLoadingBlocked] = useState(false);

  // Load Friends
  const loadFriends = useCallback(async () => {
    setLoadingFriends(true);
    try {
      const data = await api.getFriends();
      setFriends(data || []);
    } catch (err) {
      console.error("Failed to load friends:", err);
    } finally {
      setLoadingFriends(false);
    }
  }, []);

  // Load Requests
  const loadRequests = useCallback(async () => {
    setLoadingRequests(true);
    try {
      const data = await api.getFriendRequests();
      setIncomingRequests(data?.incoming || []);
      setOutgoingRequests(data?.outgoing || []);
    } catch (err) {
      console.error("Failed to load friend requests:", err);
    } finally {
      setLoadingRequests(false);
    }
  }, []);

  // Load Blocked
  const loadBlocked = useCallback(async () => {
    setLoadingBlocked(true);
    try {
      const data = await api.getBlockedUsers();
      setBlockedUsers(data || []);
    } catch (err) {
      console.error("Failed to load blocked users:", err);
    } finally {
      setLoadingBlocked(false);
    }
  }, []);

  useEffect(() => {
    if (user) {
      loadFriends();
      loadRequests();
      loadBlocked();
    }
  }, [user, loadFriends, loadRequests, loadBlocked]);

  // Debounced User Search for Adding Friends
  useEffect(() => {
    const q = searchUsersQuery.trim();
    if (q.length < 2) {
      setSearchResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setSearchingUsers(true);
      try {
        const results = await api.searchUsers(q);
        setSearchResults(results || []);
      } catch (err) {
        console.error("User search failed:", err);
      } finally {
        setSearchingUsers(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchUsersQuery]);

  // Handle Send Friend Request
  const handleSendRequest = async (target) => {
    try {
      const res = await api.sendFriendRequest(target);
      showToast(res.message || "Friend request sent.", "success");
      setSearchUsersQuery("");
      setSearchResults([]);
      loadRequests();
      loadFriends();
      refreshUnreadCounts();
    } catch (err) {
      showToast(err.message || "Failed to send friend request.", "error");
    }
  };

  // Handle Accept Request
  const handleAcceptRequest = async (requestId) => {
    try {
      await api.acceptFriendRequest(requestId);
      showToast("Friend request accepted!", "success");
      loadRequests();
      loadFriends();
      refreshUnreadCounts();
    } catch (err) {
      showToast(err.message || "Failed to accept friend request.", "error");
    }
  };

  // Handle Decline Request
  const handleDeclineRequest = async (requestId) => {
    try {
      await api.declineFriendRequest(requestId);
      showToast("Friend request declined.", "info");
      loadRequests();
      refreshUnreadCounts();
    } catch (err) {
      showToast(err.message || "Failed to decline friend request.", "error");
    }
  };

  // Handle Cancel Request
  const handleCancelRequest = async (requestId) => {
    try {
      await api.cancelFriendRequest(requestId);
      showToast("Friend request cancelled.", "info");
      loadRequests();
    } catch (err) {
      showToast(err.message || "Failed to cancel friend request.", "error");
    }
  };

  // Handle Unblock User
  const handleUnblockUser = async (userId, username) => {
    try {
      await api.unblockUser(userId);
      showToast(`Unblocked ${username}.`, "success");
      loadBlocked();
    } catch (err) {
      showToast(err.message || "Failed to unblock user.", "error");
    }
  };

  const filteredFriends = friends.filter((f) =>
    f.username.toLowerCase().includes(friendSearchQuery.toLowerCase()) ||
    f.email.toLowerCase().includes(friendSearchQuery.toLowerCase())
  );

  return (
    <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "1.5rem" }}>
      {/* Page Title & Navigation Banner */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "1rem",
          marginBottom: "1.5rem",
        }}
      >
        <div>
          <h1 style={{ fontSize: "1.75rem", fontWeight: 700, margin: 0, color: "#f8fafc" }}>
            Friends & Social
          </h1>
          <p style={{ margin: "0.25rem 0 0 0", color: "#94a3b8", fontSize: "0.9rem" }}>
            Manage direct friendships, configure trading and proxy permissions, coordinate trades in DMs, and control blocks.
          </p>
        </div>

        <button
          onClick={() => {
            loadFriends();
            loadRequests();
            loadBlocked();
            refreshConversations();
            refreshUnreadCounts();
          }}
          style={{
            backgroundColor: "#1e293b",
            color: "#94a3b8",
            border: "1px solid #334155",
            borderRadius: "8px",
            padding: "0.5rem 0.85rem",
            fontSize: "0.85rem",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: "0.4rem",
          }}
        >
          <ArrowPathIcon style={{ width: "16px", height: "16px" }} /> Refresh
        </button>
      </div>

      {/* Tabs Bar */}
      <div
        style={{
          display: "flex",
          borderBottom: "1px solid #334155",
          gap: "0.5rem",
          marginBottom: "1.5rem",
          overflowX: "auto",
        }}
      >
        <button
          onClick={() => setActiveTab("friends")}
          style={{
            background: "transparent",
            border: "none",
            borderBottom: activeTab === "friends" ? "2px solid #6366f1" : "2px solid transparent",
            color: activeTab === "friends" ? "#f8fafc" : "#94a3b8",
            padding: "0.75rem 1.25rem",
            fontWeight: 600,
            fontSize: "0.95rem",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: "0.5rem",
          }}
        >
          <UserGroupIcon style={{ width: "18px", height: "18px" }} />
          <span>Friends</span>
          <span
            style={{
              backgroundColor: activeTab === "friends" ? "#4f46e5" : "#334155",
              color: "#ffffff",
              padding: "0.1rem 0.5rem",
              borderRadius: "10px",
              fontSize: "0.75rem",
            }}
          >
            {friends.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab("requests")}
          style={{
            background: "transparent",
            border: "none",
            borderBottom: activeTab === "requests" ? "2px solid #6366f1" : "2px solid transparent",
            color: activeTab === "requests" ? "#f8fafc" : "#94a3b8",
            padding: "0.75rem 1.25rem",
            fontWeight: 600,
            fontSize: "0.95rem",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: "0.5rem",
          }}
        >
          <UserPlusIcon style={{ width: "18px", height: "18px" }} />
          <span>Requests</span>
          {incomingRequests.length > 0 && (
            <span
              style={{
                backgroundColor: "#ef4444",
                color: "#ffffff",
                padding: "0.1rem 0.5rem",
                borderRadius: "10px",
                fontSize: "0.75rem",
                fontWeight: 700,
              }}
            >
              {incomingRequests.length}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab("messages")}
          style={{
            background: "transparent",
            border: "none",
            borderBottom: activeTab === "messages" ? "2px solid #6366f1" : "2px solid transparent",
            color: activeTab === "messages" ? "#f8fafc" : "#94a3b8",
            padding: "0.75rem 1.25rem",
            fontWeight: 600,
            fontSize: "0.95rem",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: "0.5rem",
          }}
        >
          <ChatBubbleLeftRightIcon style={{ width: "18px", height: "18px" }} />
          <span>Trading DMs</span>
          {unreadMessagesCount > 0 && (
            <span
              style={{
                backgroundColor: "#3b82f6",
                color: "#ffffff",
                padding: "0.1rem 0.5rem",
                borderRadius: "10px",
                fontSize: "0.75rem",
                fontWeight: 700,
              }}
            >
              {unreadMessagesCount}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab("blocked")}
          style={{
            background: "transparent",
            border: "none",
            borderBottom: activeTab === "blocked" ? "2px solid #6366f1" : "2px solid transparent",
            color: activeTab === "blocked" ? "#f8fafc" : "#94a3b8",
            padding: "0.75rem 1.25rem",
            fontWeight: 600,
            fontSize: "0.95rem",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: "0.5rem",
          }}
        >
          <NoSymbolIcon style={{ width: "18px", height: "18px" }} />
          <span>Blocked</span>
          {blockedUsers.length > 0 && (
            <span
              style={{
                backgroundColor: "#334155",
                color: "#ffffff",
                padding: "0.1rem 0.5rem",
                borderRadius: "10px",
                fontSize: "0.75rem",
              }}
            >
              {blockedUsers.length}
            </span>
          )}
        </button>
      </div>

      {/* Tab 1: Friends List */}
      {activeTab === "friends" && (
        <div>
          {/* Search bar */}
          <div style={{ marginBottom: "1.25rem", position: "relative", maxWidth: "400px" }}>
            <MagnifyingGlassIcon
              style={{
                position: "absolute",
                left: "12px",
                top: "50%",
                transform: "translateY(-50%)",
                width: "18px",
                height: "18px",
                color: "#64748b",
              }}
            />
            <input
              type="text"
              placeholder="Search friends by username or email..."
              value={friendSearchQuery}
              onChange={(e) => setFriendSearchQuery(e.target.value)}
              style={{
                width: "100%",
                padding: "0.6rem 1rem 0.6rem 2.5rem",
                backgroundColor: "#1e293b",
                border: "1px solid #334155",
                borderRadius: "8px",
                color: "#f8fafc",
                fontSize: "0.9rem",
                outline: "none",
              }}
            />
          </div>

          {loadingFriends ? (
            <div style={{ textAlign: "center", padding: "3rem", color: "#64748b" }}>
              Loading friends list...
            </div>
          ) : filteredFriends.length === 0 ? (
            <div
              style={{
                backgroundColor: "#1e293b",
                border: "1px dashed #334155",
                borderRadius: "12px",
                padding: "3rem",
                textAlign: "center",
                color: "#94a3b8",
              }}
            >
              <UserGroupIcon style={{ width: "48px", height: "48px", margin: "0 auto 1rem auto", opacity: 0.4 }} />
              <h3 style={{ margin: "0 0 0.5rem 0", color: "#f8fafc" }}>No friends found</h3>
              <p style={{ margin: "0 0 1.5rem 0", fontSize: "0.9rem" }}>
                {friendSearchQuery ? "No friends match your search query." : "Connect with other collectors to trade and order proxies together."}
              </p>
              <button
                onClick={() => setActiveTab("requests")}
                style={{
                  backgroundColor: "#6366f1",
                  color: "#ffffff",
                  border: "none",
                  borderRadius: "8px",
                  padding: "0.65rem 1.25rem",
                  fontWeight: 600,
                  fontSize: "0.9rem",
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "0.5rem",
                }}
              >
                <UserPlusIcon style={{ width: "18px", height: "18px" }} /> Add Friends
              </button>
            </div>
          ) : (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(360px, 1fr))",
                gap: "1rem",
              }}
            >
              {filteredFriends.map((f) => {
                const isOnline = onlineUsers.has(f.id) || f.is_online;
                const canTradeTogether = f.allow_trading && f.friend_allows_trading;

                return (
                  <div
                    key={f.id}
                    style={{
                      backgroundColor: "#1e293b",
                      border: "1px solid #334155",
                      borderRadius: "12px",
                      padding: "1.25rem",
                      display: "flex",
                      flexDirection: "column",
                      justifyContent: "space-between",
                      gap: "1rem",
                    }}
                  >
                    {/* User profile row */}
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                        <div style={{ position: "relative" }}>
                          {f.avatar_url ? (
                            <img
                              src={f.avatar_url}
                              alt={f.username}
                              style={{ width: "44px", height: "44px", borderRadius: "50%", objectFit: "cover" }}
                            />
                          ) : (
                            <UserCircleIcon style={{ width: "44px", height: "44px", color: "#64748b" }} />
                          )}
                          <span
                            style={{
                              position: "absolute",
                              bottom: 0,
                              right: 0,
                              width: "12px",
                              height: "12px",
                              borderRadius: "50%",
                              backgroundColor: isOnline ? "#10b981" : "#64748b",
                              border: "2px solid #1e293b",
                            }}
                            title={isOnline ? "Online" : "Offline"}
                          />
                        </div>
                        <div>
                          <div style={{ fontWeight: 600, color: "#f8fafc", fontSize: "1rem" }}>{f.username}</div>
                          <div style={{ fontSize: "0.8rem", color: "#94a3b8" }}>{f.email}</div>
                        </div>
                      </div>

                      <button
                        onClick={() => setSelectedFriendForSettings(f)}
                        style={{
                          background: "#0f172a",
                          border: "1px solid #334155",
                          borderRadius: "8px",
                          color: "#cbd5e1",
                          padding: "6px",
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                        title="Configure friend permissions"
                      >
                        <Cog6ToothIcon style={{ width: "18px", height: "18px" }} />
                      </button>
                    </div>

                    {/* Permissions summary */}
                    <div
                      style={{
                        backgroundColor: "#0f172a",
                        borderRadius: "8px",
                        padding: "0.75rem",
                        display: "flex",
                        flexDirection: "column",
                        gap: "0.4rem",
                        fontSize: "0.8rem",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                        <span style={{ color: "#94a3b8", display: "flex", alignItems: "center", gap: "4px" }}>
                          <ArrowsRightLeftIcon style={{ width: "14px", height: "14px", color: "#38bdf8" }} /> Trading:
                        </span>
                        <span style={{ fontWeight: 600, color: canTradeTogether ? "#10b981" : "#94a3b8" }}>
                          {canTradeTogether
                            ? "Enabled (Mutual)"
                            : !f.allow_trading
                            ? "Disabled by You"
                            : "Disabled by Friend"}
                        </span>
                      </div>

                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                        <span style={{ color: "#94a3b8", display: "flex", alignItems: "center", gap: "4px" }}>
                          <PrinterIcon style={{ width: "14px", height: "14px", color: "#a855f7" }} /> Proxy Orders:
                        </span>
                        <span style={{ fontWeight: 600, color: f.allow_proxy_orders ? "#a855f7" : "#64748b" }}>
                          {f.allow_proxy_orders ? "Allowed by You" : "Not Allowed"}
                        </span>
                      </div>
                    </div>

                    {/* Action buttons */}
                    <div style={{ display: "flex", gap: "0.5rem" }}>
                      <button
                        onClick={() => openChatWithFriend(f)}
                        style={{
                          flex: 1,
                          backgroundColor: "#4f46e5",
                          color: "#ffffff",
                          border: "none",
                          borderRadius: "8px",
                          padding: "0.55rem 0.75rem",
                          fontWeight: 600,
                          fontSize: "0.85rem",
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: "0.4rem",
                        }}
                      >
                        <ChatBubbleLeftRightIcon style={{ width: "16px", height: "16px" }} /> Trade DM
                      </button>

                      <button
                        onClick={() => setSelectedFriendForSettings(f)}
                        style={{
                          backgroundColor: "#334155",
                          color: "#f8fafc",
                          border: "none",
                          borderRadius: "8px",
                          padding: "0.55rem 0.85rem",
                          fontWeight: 500,
                          fontSize: "0.85rem",
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          gap: "0.3rem",
                        }}
                      >
                        Permissions
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Requests & Add Friend */}
      {activeTab === "requests" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "2rem" }}>
          {/* Add Friend search card */}
          <div
            style={{
              backgroundColor: "#1e293b",
              border: "1px solid #334155",
              borderRadius: "12px",
              padding: "1.5rem",
            }}
          >
            <h3 style={{ margin: "0 0 0.5rem 0", color: "#f8fafc", fontSize: "1.1rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <UserPlusIcon style={{ width: "20px", height: "20px", color: "#6366f1" }} /> Add Friend
            </h3>
            <p style={{ margin: "0 0 1rem 0", color: "#94a3b8", fontSize: "0.88rem" }}>
              Search for other collectors by their username or email to send a friend request.
            </p>

            <div style={{ position: "relative", maxWidth: "500px" }}>
              <MagnifyingGlassIcon
                style={{
                  position: "absolute",
                  left: "12px",
                  top: "50%",
                  transform: "translateY(-50%)",
                  width: "18px",
                  height: "18px",
                  color: "#64748b",
                }}
              />
              <input
                type="text"
                placeholder="Enter exact username or email..."
                value={searchUsersQuery}
                onChange={(e) => setSearchUsersQuery(e.target.value)}
                style={{
                  width: "100%",
                  padding: "0.65rem 1rem 0.65rem 2.5rem",
                  backgroundColor: "#0f172a",
                  border: "1px solid #475569",
                  borderRadius: "8px",
                  color: "#f8fafc",
                  fontSize: "0.9rem",
                  outline: "none",
                }}
              />
            </div>

            {/* Search results dropdown/list */}
            {searchingUsers ? (
              <div style={{ marginTop: "1rem", color: "#64748b", fontSize: "0.85rem" }}>Searching users...</div>
            ) : searchResults.length > 0 ? (
              <div
                style={{
                  marginTop: "1rem",
                  display: "flex",
                  flexDirection: "column",
                  gap: "0.5rem",
                  maxWidth: "500px",
                }}
              >
                {searchResults.map((userResult) => (
                  <div
                    key={userResult.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "0.75rem 1rem",
                      backgroundColor: "#0f172a",
                      border: "1px solid #334155",
                      borderRadius: "8px",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                      {userResult.avatar_url ? (
                        <img
                          src={userResult.avatar_url}
                          alt={userResult.username}
                          style={{ width: "36px", height: "36px", borderRadius: "50%", objectFit: "cover" }}
                        />
                      ) : (
                        <UserCircleIcon style={{ width: "36px", height: "36px", color: "#64748b" }} />
                      )}
                      <div>
                        <div style={{ fontWeight: 600, color: "#f8fafc" }}>{userResult.username}</div>
                        <div style={{ fontSize: "0.8rem", color: "#94a3b8" }}>{userResult.email}</div>
                      </div>
                    </div>

                    {userResult.relationship === "friend" ? (
                      <span style={{ fontSize: "0.8rem", color: "#10b981", fontWeight: 600 }}>Already Friends</span>
                    ) : userResult.relationship === "pending_outgoing" ? (
                      <span style={{ fontSize: "0.8rem", color: "#eab308", fontWeight: 600 }}>Request Sent</span>
                    ) : userResult.relationship === "pending_incoming" ? (
                      <button
                        onClick={() => handleAcceptRequest(userResult.request_id)}
                        style={{
                          backgroundColor: "#10b981",
                          color: "#ffffff",
                          border: "none",
                          borderRadius: "6px",
                          padding: "0.4rem 0.85rem",
                          fontSize: "0.82rem",
                          fontWeight: 600,
                          cursor: "pointer",
                        }}
                      >
                        Accept Request
                      </button>
                    ) : (
                      <button
                        onClick={() => handleSendRequest(userResult.id)}
                        style={{
                          backgroundColor: "#6366f1",
                          color: "#ffffff",
                          border: "none",
                          borderRadius: "6px",
                          padding: "0.4rem 0.85rem",
                          fontSize: "0.82rem",
                          fontWeight: 600,
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          gap: "4px",
                        }}
                      >
                        <UserPlusIcon style={{ width: "14px", height: "14px" }} /> Add
                      </button>
                    )}
                  </div>
                ))}
              </div>
            ) : searchUsersQuery.trim().length >= 2 && !searchingUsers ? (
              <div style={{ marginTop: "1rem", color: "#94a3b8", fontSize: "0.85rem" }}>
                No users found matching "{searchUsersQuery}".
              </div>
            ) : null}
          </div>

          {/* Incoming Requests Section */}
          <div>
            <h3 style={{ fontSize: "1.1rem", fontWeight: 600, color: "#f8fafc", marginBottom: "0.75rem" }}>
              Incoming Requests ({incomingRequests.length})
            </h3>
            {incomingRequests.length === 0 ? (
              <div
                style={{
                  backgroundColor: "#1e293b",
                  border: "1px dashed #334155",
                  borderRadius: "10px",
                  padding: "1.5rem",
                  color: "#94a3b8",
                  fontSize: "0.9rem",
                }}
              >
                No pending incoming friend requests.
              </div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: "0.75rem" }}>
                {incomingRequests.map((req) => (
                  <div
                    key={req.request_id}
                    style={{
                      backgroundColor: "#1e293b",
                      border: "1px solid #334155",
                      borderRadius: "10px",
                      padding: "1rem",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                      {req.avatar_url ? (
                        <img
                          src={req.avatar_url}
                          alt={req.username}
                          style={{ width: "40px", height: "40px", borderRadius: "50%", objectFit: "cover" }}
                        />
                      ) : (
                        <UserCircleIcon style={{ width: "40px", height: "40px", color: "#64748b" }} />
                      )}
                      <div>
                        <div style={{ fontWeight: 600, color: "#f8fafc" }}>{req.username}</div>
                        <div style={{ fontSize: "0.78rem", color: "#94a3b8" }}>{req.email}</div>
                      </div>
                    </div>

                    <div style={{ display: "flex", gap: "0.5rem" }}>
                      <button
                        onClick={() => handleAcceptRequest(req.request_id)}
                        style={{
                          backgroundColor: "#10b981",
                          color: "#ffffff",
                          border: "none",
                          borderRadius: "6px",
                          padding: "0.45rem 0.75rem",
                          fontSize: "0.82rem",
                          fontWeight: 600,
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          gap: "4px",
                        }}
                        title="Accept friend request"
                      >
                        <CheckIcon style={{ width: "16px", height: "16px" }} /> Accept
                      </button>

                      <button
                        onClick={() => handleDeclineRequest(req.request_id)}
                        style={{
                          backgroundColor: "#334155",
                          color: "#94a3b8",
                          border: "none",
                          borderRadius: "6px",
                          padding: "0.45rem 0.6rem",
                          fontSize: "0.82rem",
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                        }}
                        title="Decline request"
                      >
                        <XMarkIcon style={{ width: "16px", height: "16px" }} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Outgoing Requests Section */}
          <div>
            <h3 style={{ fontSize: "1.1rem", fontWeight: 600, color: "#f8fafc", marginBottom: "0.75rem" }}>
              Outgoing Requests ({outgoingRequests.length})
            </h3>
            {outgoingRequests.length === 0 ? (
              <div
                style={{
                  backgroundColor: "#1e293b",
                  border: "1px dashed #334155",
                  borderRadius: "10px",
                  padding: "1.5rem",
                  color: "#94a3b8",
                  fontSize: "0.9rem",
                }}
              >
                No pending outgoing friend requests.
              </div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: "0.75rem" }}>
                {outgoingRequests.map((req) => (
                  <div
                    key={req.request_id}
                    style={{
                      backgroundColor: "#1e293b",
                      border: "1px solid #334155",
                      borderRadius: "10px",
                      padding: "1rem",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                      {req.avatar_url ? (
                        <img
                          src={req.avatar_url}
                          alt={req.username}
                          style={{ width: "40px", height: "40px", borderRadius: "50%", objectFit: "cover" }}
                        />
                      ) : (
                        <UserCircleIcon style={{ width: "40px", height: "40px", color: "#64748b" }} />
                      )}
                      <div>
                        <div style={{ fontWeight: 600, color: "#f8fafc" }}>{req.username}</div>
                        <div style={{ fontSize: "0.78rem", color: "#94a3b8" }}>{req.email}</div>
                      </div>
                    </div>

                    <button
                      onClick={() => handleCancelRequest(req.request_id)}
                      style={{
                        backgroundColor: "#334155",
                        color: "#94a3b8",
                        border: "none",
                        borderRadius: "6px",
                        padding: "0.45rem 0.75rem",
                        fontSize: "0.82rem",
                        cursor: "pointer",
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab 3: Messages / Conversations */}
      {activeTab === "messages" && (
        <div>
          {conversations.length === 0 ? (
            <div
              style={{
                backgroundColor: "#1e293b",
                border: "1px dashed #334155",
                borderRadius: "12px",
                padding: "3rem",
                textAlign: "center",
                color: "#94a3b8",
              }}
            >
              <ChatBubbleLeftRightIcon style={{ width: "48px", height: "48px", margin: "0 auto 1rem auto", opacity: 0.4 }} />
              <h3 style={{ margin: "0 0 0.5rem 0", color: "#f8fafc" }}>No conversation history</h3>
              <p style={{ margin: 0, fontSize: "0.9rem" }}>
                Direct messages let you negotiate card trades and coordinate deliveries with friends in real time.
              </p>
            </div>
          ) : (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(360px, 1fr))",
                gap: "1rem",
              }}
            >
              {conversations.map((conv) => {
                const isOnline = onlineUsers.has(conv.friend.id) || conv.friend.is_online;
                return (
                  <div
                    key={conv.friend.id}
                    onClick={() => openChatWithFriend(conv.friend)}
                    style={{
                      backgroundColor: "#1e293b",
                      border: "1px solid #334155",
                      borderRadius: "12px",
                      padding: "1.25rem",
                      cursor: "pointer",
                      display: "flex",
                      flexDirection: "column",
                      gap: "0.75rem",
                      transition: "border-color 0.15s ease",
                    }}
                    onMouseOver={(e) => (e.currentTarget.style.borderColor = "#6366f1")}
                    onMouseOut={(e) => (e.currentTarget.style.borderColor = "#334155")}
                  >
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                        <div style={{ position: "relative" }}>
                          {conv.friend.avatar_url ? (
                            <img
                              src={conv.friend.avatar_url}
                              alt={conv.friend.username}
                              style={{ width: "40px", height: "40px", borderRadius: "50%", objectFit: "cover" }}
                            />
                          ) : (
                            <UserCircleIcon style={{ width: "40px", height: "40px", color: "#64748b" }} />
                          )}
                          <span
                            style={{
                              position: "absolute",
                              bottom: 0,
                              right: 0,
                              width: "10px",
                              height: "10px",
                              borderRadius: "50%",
                              backgroundColor: isOnline ? "#10b981" : "#64748b",
                              border: "2px solid #1e293b",
                            }}
                          />
                        </div>
                        <div>
                          <div style={{ fontWeight: 600, color: "#f8fafc" }}>{conv.friend.username}</div>
                          <div style={{ fontSize: "0.78rem", color: "#94a3b8" }}>{conv.friend.email}</div>
                        </div>
                      </div>

                      {conv.unread_count > 0 && (
                        <span
                          style={{
                            backgroundColor: "#3b82f6",
                            color: "#ffffff",
                            padding: "0.15rem 0.55rem",
                            borderRadius: "10px",
                            fontSize: "0.78rem",
                            fontWeight: 700,
                          }}
                        >
                          {conv.unread_count} new
                        </span>
                      )}
                    </div>

                    <div
                      style={{
                        backgroundColor: "#0f172a",
                        borderRadius: "8px",
                        padding: "0.6rem 0.85rem",
                        color: "#94a3b8",
                        fontSize: "0.85rem",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {conv.last_message ? (
                        <span>
                          {conv.last_message.sender_id === user?.id ? "You: " : ""}{conv.last_message.content}
                        </span>
                      ) : (
                        <span style={{ fontStyle: "italic", opacity: 0.6 }}>No messages exchanged</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Tab 4: Blocked Users */}
      {activeTab === "blocked" && (
        <div>
          {loadingBlocked ? (
            <div style={{ textAlign: "center", padding: "3rem", color: "#64748b" }}>
              Loading blocked users...
            </div>
          ) : blockedUsers.length === 0 ? (
            <div
              style={{
                backgroundColor: "#1e293b",
                border: "1px dashed #334155",
                borderRadius: "12px",
                padding: "3rem",
                textAlign: "center",
                color: "#94a3b8",
              }}
            >
              <ShieldCheckIcon style={{ width: "48px", height: "48px", margin: "0 auto 1rem auto", color: "#10b981", opacity: 0.7 }} />
              <h3 style={{ margin: "0 0 0.5rem 0", color: "#f8fafc" }}>No blocked users</h3>
              <p style={{ margin: 0, fontSize: "0.9rem" }}>
                You haven't blocked anyone. Blocked users cannot see your trade matches, send friend requests, or message you.
              </p>
            </div>
          ) : (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
                gap: "1rem",
              }}
            >
              {blockedUsers.map((b) => (
                <div
                  key={b.id}
                  style={{
                    backgroundColor: "#1e293b",
                    border: "1px solid #7f1d1d",
                    borderRadius: "10px",
                    padding: "1rem",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                    {b.avatar_url ? (
                      <img
                        src={b.avatar_url}
                        alt={b.username}
                        style={{ width: "40px", height: "40px", borderRadius: "50%", objectFit: "cover" }}
                      />
                    ) : (
                      <UserCircleIcon style={{ width: "40px", height: "40px", color: "#64748b" }} />
                    )}
                    <div>
                      <div style={{ fontWeight: 600, color: "#f8fafc" }}>{b.username}</div>
                      <div style={{ fontSize: "0.78rem", color: "#94a3b8" }}>{b.email}</div>
                    </div>
                  </div>

                  <button
                    onClick={() => handleUnblockUser(b.id, b.username)}
                    style={{
                      backgroundColor: "#334155",
                      color: "#f8fafc",
                      border: "none",
                      borderRadius: "6px",
                      padding: "0.45rem 0.75rem",
                      fontSize: "0.82rem",
                      cursor: "pointer",
                    }}
                  >
                    Unblock
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Permissions Settings Modal */}
      {selectedFriendForSettings && (
        <FriendSettingsModal
          friend={selectedFriendForSettings}
          onClose={() => setSelectedFriendForSettings(null)}
          onSettingsUpdated={(updated) => {
            setFriends((prev) => prev.map((f) => (f.id === updated.id ? updated : f)));
          }}
          onFriendRemoved={(friendId) => {
            setFriends((prev) => prev.filter((f) => f.id !== friendId));
          }}
          onUserBlocked={(userId) => {
            setFriends((prev) => prev.filter((f) => f.id !== userId));
            loadBlocked();
          }}
        />
      )}
    </div>
  );
}
