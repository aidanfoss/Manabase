// frontend/src/components/friends/FriendSettingsModal.jsx
import React, { useState } from "react";
import {
  XMarkIcon,
  Cog6ToothIcon,
  ArrowsRightLeftIcon,
  PrinterIcon,
  TrashIcon,
  NoSymbolIcon,
  ExclamationTriangleIcon,
  UserCircleIcon,
  CheckIcon,
} from "@heroicons/react/24/solid";
import { api } from "../../api/client";
import { useToast } from "../../context/ToastContext";

export default function FriendSettingsModal({ friend, onClose, onSettingsUpdated, onFriendRemoved, onUserBlocked }) {
  const { showToast } = useToast();
  const [allowTrading, setAllowTrading] = useState(friend.allow_trading ?? true);
  const [allowProxyOrders, setAllowProxyOrders] = useState(friend.allow_proxy_orders ?? false);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmBlock, setConfirmBlock] = useState(false);

  const handleSaveSettings = async () => {
    setSaving(true);
    try {
      await api.updateFriendSettings(friend.id, {
        allow_trading: allowTrading,
        allow_proxy_orders: allowProxyOrders,
      });
      showToast(`Updated permissions for ${friend.username}.`, "success");
      onSettingsUpdated?.({
        ...friend,
        allow_trading: allowTrading,
        allow_proxy_orders: allowProxyOrders,
      });
      onClose();
    } catch (err) {
      showToast(err.message || "Failed to save settings.", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveFriend = async () => {
    try {
      await api.removeFriend(friend.id);
      showToast(`Removed ${friend.username} from friends.`, "info");
      onFriendRemoved?.(friend.id);
      onClose();
    } catch (err) {
      showToast(err.message || "Failed to remove friend.", "error");
    }
  };

  const handleBlockUser = async () => {
    try {
      await api.blockUser(friend.id);
      showToast(`Blocked ${friend.username}. Friendship severed.`, "warning");
      onUserBlocked?.(friend.id);
      onClose();
    } catch (err) {
      showToast(err.message || "Failed to block user.", "error");
    }
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(0, 0, 0, 0.7)",
        backdropFilter: "blur(4px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 10000,
        padding: "1rem",
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: "#0f172a",
          border: "1px solid #334155",
          borderRadius: "16px",
          width: "500px",
          maxWidth: "100%",
          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.5)",
          overflow: "hidden",
          color: "#f8fafc",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "1.25rem 1.5rem",
            backgroundColor: "#1e293b",
            borderBottom: "1px solid #334155",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
            <Cog6ToothIcon style={{ width: "22px", height: "22px", color: "#38bdf8" }} />
            <h3 style={{ margin: 0, fontSize: "1.1rem", fontWeight: 600 }}>
              Permissions: {friend.username}
            </h3>
          </div>
          <button
            onClick={onClose}
            style={{
              background: "transparent",
              border: "none",
              color: "#94a3b8",
              cursor: "pointer",
              padding: "4px",
              borderRadius: "6px",
            }}
          >
            <XMarkIcon style={{ width: "20px", height: "20px" }} />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: "1.5rem", display: "flex", flexDirection: "column", gap: "1.5rem" }}>
          {/* User profile card */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "1rem",
              padding: "0.85rem",
              backgroundColor: "#1e293b",
              borderRadius: "10px",
              border: "1px solid #334155",
            }}
          >
            {friend.avatar_url ? (
              <img
                src={friend.avatar_url}
                alt={friend.username}
                style={{ width: "44px", height: "44px", borderRadius: "50%", objectFit: "cover" }}
              />
            ) : (
              <UserCircleIcon style={{ width: "44px", height: "44px", color: "#64748b" }} />
            )}
            <div>
              <div style={{ fontWeight: 600, fontSize: "1rem" }}>{friend.username}</div>
              <div style={{ fontSize: "0.8rem", color: "#94a3b8" }}>{friend.email}</div>
            </div>
          </div>

          {/* Toggle: Trading Permission */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
              gap: "1rem",
              padding: "1rem",
              backgroundColor: "#1e293b",
              borderRadius: "10px",
              border: "1px solid #334155",
            }}
          >
            <div style={{ flex: 1 }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontWeight: 600, fontSize: "0.95rem" }}>
                <ArrowsRightLeftIcon style={{ width: "16px", height: "16px", color: "#38bdf8" }} />
                <span>Allow Trading</span>
              </div>
              <p style={{ margin: "0.35rem 0 0 0", fontSize: "0.82rem", color: "#94a3b8", lineHeight: 1.4 }}>
                Permits this friend to view trade matches with your collection and propose trades. Both friends must enable this for trade matching.
              </p>
              {!friend.friend_allows_trading && (
                <div style={{ marginTop: "0.5rem", fontSize: "0.78rem", color: "#f59e0b" }}>
                  Note: {friend.username} has currently disabled trading from their end.
                </div>
              )}
            </div>

            <label style={{ position: "relative", display: "inline-block", width: "44px", height: "24px", flexShrink: 0, cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={allowTrading}
                onChange={(e) => setAllowTrading(e.target.checked)}
                style={{ opacity: 0, width: 0, height: 0 }}
              />
              <span
                style={{
                  position: "absolute",
                  inset: 0,
                  backgroundColor: allowTrading ? "#6366f1" : "#475569",
                  borderRadius: "24px",
                  transition: "0.2s",
                }}
              >
                <span
                  style={{
                    position: "absolute",
                    content: "",
                    height: "18px",
                    width: "18px",
                    left: allowTrading ? "23px" : "3px",
                    bottom: "3px",
                    backgroundColor: "white",
                    borderRadius: "50%",
                    transition: "0.2s",
                  }}
                />
              </span>
            </label>
          </div>

          {/* Toggle: Proxy Orders Permission */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
              gap: "1rem",
              padding: "1rem",
              backgroundColor: "#1e293b",
              borderRadius: "10px",
              border: "1px solid #334155",
            }}
          >
            <div style={{ flex: 1 }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontWeight: 600, fontSize: "0.95rem" }}>
                <PrinterIcon style={{ width: "16px", height: "16px", color: "#a855f7" }} />
                <span>Allow Proxy Orders</span>
              </div>
              <p style={{ margin: "0.35rem 0 0 0", fontSize: "0.82rem", color: "#94a3b8", lineHeight: 1.4 }}>
                Permits this friend to include cards from your proxy wishlist when assembling bulk MPC proxy manifests and shared printing orders.
              </p>
              {friend.friend_allows_proxy_orders && (
                <div style={{ marginTop: "0.5rem", fontSize: "0.78rem", color: "#10b981" }}>
                  {friend.username} has authorized you to order proxies for them.
                </div>
              )}
            </div>

            <label style={{ position: "relative", display: "inline-block", width: "44px", height: "24px", flexShrink: 0, cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={allowProxyOrders}
                onChange={(e) => setAllowProxyOrders(e.target.checked)}
                style={{ opacity: 0, width: 0, height: 0 }}
              />
              <span
                style={{
                  position: "absolute",
                  inset: 0,
                  backgroundColor: allowProxyOrders ? "#a855f7" : "#475569",
                  borderRadius: "24px",
                  transition: "0.2s",
                }}
              >
                <span
                  style={{
                    position: "absolute",
                    content: "",
                    height: "18px",
                    width: "18px",
                    left: allowProxyOrders ? "23px" : "3px",
                    bottom: "3px",
                    backgroundColor: "white",
                    borderRadius: "50%",
                    transition: "0.2s",
                  }}
                />
              </span>
            </label>
          </div>

          {/* Action: Save Button */}
          <button
            onClick={handleSaveSettings}
            disabled={saving}
            style={{
              backgroundColor: "#6366f1",
              color: "#ffffff",
              border: "none",
              borderRadius: "8px",
              padding: "0.75rem 1rem",
              fontWeight: 600,
              cursor: saving ? "default" : "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "0.5rem",
              fontSize: "0.9rem",
            }}
          >
            <CheckIcon style={{ width: "18px", height: "18px" }} />
            {saving ? "Saving Changes..." : "Save Settings"}
          </button>

          {/* Danger Zone */}
          <div style={{ borderTop: "1px solid #334155", paddingTop: "1rem", display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            <div style={{ fontSize: "0.82rem", fontWeight: 600, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Relationship Actions
            </div>

            <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
              {confirmDelete ? (
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  <button
                    onClick={handleRemoveFriend}
                    style={{
                      backgroundColor: "#dc2626",
                      color: "#ffffff",
                      border: "none",
                      borderRadius: "6px",
                      padding: "0.5rem 0.85rem",
                      fontSize: "0.82rem",
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    Confirm Remove Friend
                  </button>
                  <button
                    onClick={() => setConfirmDelete(false)}
                    style={{
                      backgroundColor: "#334155",
                      color: "#94a3b8",
                      border: "none",
                      borderRadius: "6px",
                      padding: "0.5rem 0.85rem",
                      fontSize: "0.82rem",
                      cursor: "pointer",
                    }}
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setConfirmDelete(true)}
                  style={{
                    backgroundColor: "transparent",
                    color: "#f87171",
                    border: "1px solid #7f1d1d",
                    borderRadius: "6px",
                    padding: "0.5rem 0.85rem",
                    fontSize: "0.82rem",
                    fontWeight: 500,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: "0.4rem",
                  }}
                >
                  <TrashIcon style={{ width: "14px", height: "14px" }} />
                  Remove Friend
                </button>
              )}

              {confirmBlock ? (
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  <button
                    onClick={handleBlockUser}
                    style={{
                      backgroundColor: "#b91c1c",
                      color: "#ffffff",
                      border: "none",
                      borderRadius: "6px",
                      padding: "0.5rem 0.85rem",
                      fontSize: "0.82rem",
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    Confirm Block
                  </button>
                  <button
                    onClick={() => setConfirmBlock(false)}
                    style={{
                      backgroundColor: "#334155",
                      color: "#94a3b8",
                      border: "none",
                      borderRadius: "6px",
                      padding: "0.5rem 0.85rem",
                      fontSize: "0.82rem",
                      cursor: "pointer",
                    }}
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setConfirmBlock(true)}
                  style={{
                    backgroundColor: "transparent",
                    color: "#ef4444",
                    border: "1px solid #991b1b",
                    borderRadius: "6px",
                    padding: "0.5rem 0.85rem",
                    fontSize: "0.82rem",
                    fontWeight: 500,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: "0.4rem",
                  }}
                  title="Sever friendship and block future communication"
                >
                  <NoSymbolIcon style={{ width: "14px", height: "14px" }} />
                  Block User
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
