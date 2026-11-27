// frontend/src/components/wishlist/FriendsProxyManifest.jsx
import React, { useState, useEffect, useMemo } from "react";
import {
  PrinterIcon,
  UserGroupIcon,
  SparklesIcon,
  RocketLaunchIcon,
  ClipboardDocumentListIcon,
  CheckCircleIcon,
  ArrowPathIcon,
  BanknotesIcon,
  ShieldCheckIcon,
  DocumentArrowDownIcon,
  InformationCircleIcon,
  UserCircleIcon,
} from "@heroicons/react/24/solid";
import { api } from "../../api/client";
import { useToast } from "../../context/ToastContext";
import { useAuth } from "../../context/AuthContext";
import { formatMpcTextList } from "../../utils/cardHelpers";

export default function FriendsProxyManifest({ onOrderConfirmed }) {
  const { user } = useAuth();
  const { showToast } = useToast();

  const [loading, setLoading] = useState(true);
  const [friends, setFriends] = useState([]);
  const [queueCards, setQueueCards] = useState([]);
  const [unitCost, setUnitCost] = useState(0.25);
  const [confirmingOrder, setConfirmingOrder] = useState(false);
  const [selectedUserFilter, setSelectedUserFilter] = useState("all");

  const loadQueue = async () => {
    setLoading(true);
    try {
      const data = await api.getFriendsProxyQueue();
      setFriends(data?.friends || []);
      setQueueCards(data?.cards || []);
    } catch (err) {
      console.error("Failed to load friends proxy queue:", err);
      showToast(err.message || "Failed to load proxy queue.", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadQueue();
  }, []);

  // Filtered cards
  const displayedCards = useMemo(() => {
    if (selectedUserFilter === "all") return queueCards;
    if (selectedUserFilter === "me") return queueCards.filter((c) => c.user_id === user?.id);
    return queueCards.filter((c) => c.user_id === selectedUserFilter);
  }, [queueCards, selectedUserFilter, user]);

  // Breakdown per user
  const userBreakdown = useMemo(() => {
    const map = {};
    queueCards.forEach((c) => {
      const uname = c.username || (c.user_id === user?.id ? "You" : "Unknown");
      if (!map[uname]) {
        map[uname] = { count: 0, cost: 0, userId: c.user_id };
      }
      const qty = c.quantity || 1;
      map[uname].count += qty;
      map[uname].cost += qty * unitCost;
    });
    return map;
  }, [queueCards, unitCost, user]);

  const totalCardsCount = useMemo(() => {
    return queueCards.reduce((acc, c) => acc + (c.quantity || 1), 0);
  }, [queueCards]);

  const totalCost = (totalCardsCount * unitCost).toFixed(2);

  // Copy MPC text format
  const handleCopyMpcList = async () => {
    if (displayedCards.length === 0) return;
    try {
      const text = formatMpcTextList(displayedCards);
      await navigator.clipboard.writeText(text);
      showToast("MPC formatted card list copied to clipboard!", "success");
    } catch (err) {
      showToast("Failed to copy card list.", "error");
    }
  };

  // Download CSV
  const handleDownloadCsv = () => {
    if (displayedCards.length === 0) return;
    const headers = ["Card Name", "Quantity", "Set Code", "Collector Number", "Owner", "List Type"];
    const rows = displayedCards.map((c) => [
      `"${c.card_name.replace(/"/g, '""')}"`,
      c.quantity || 1,
      `"${c.set_code || ""}"`,
      `"${c.collector_number || ""}"`,
      `"${c.username || ""}"`,
      `"${c.list_type || ""}"`,
    ]);
    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `manabase-friends-proxy-manifest-${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast("Manifest CSV downloaded.", "success");
  };

  // Confirm order
  const handleConfirmOrder = async () => {
    if (queueCards.length === 0) return;
    if (!window.confirm(`Are you sure you want to confirm and finalize this proxy order of ${totalCardsCount} cards ($${totalCost})? This will save the order to your history.`)) {
      return;
    }

    setConfirmingOrder(true);
    try {
      await api.confirmProxyOrder({
        cards: queueCards,
        unit_cost: unitCost,
        title: `Friends Bulk Order (${totalCardsCount} cards)`,
      });
      showToast("Proxy order confirmed and saved to Order History!", "success");
      await loadQueue();
      onOrderConfirmed?.();
    } catch (err) {
      showToast(err.message || "Failed to confirm proxy order.", "error");
    } finally {
      setConfirmingOrder(false);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      {/* Header Banner */}
      <div
        style={{
          backgroundColor: "#1e293b",
          border: "1px solid #334155",
          borderRadius: "12px",
          padding: "1.5rem",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          flexWrap: "wrap",
          gap: "1rem",
        }}
      >
        <div>
          <h2
            style={{
              margin: "0 0 0.5rem 0",
              color: "#f8fafc",
              fontSize: "1.35rem",
              fontWeight: 700,
              display: "flex",
              alignItems: "center",
              gap: "0.6rem",
            }}
          >
            <PrinterIcon style={{ width: "24px", height: "24px", color: "#a855f7" }} />
            Friends Proxy Manifest
          </h2>
          <p style={{ margin: 0, color: "#94a3b8", fontSize: "0.9rem", maxWidth: "700px" }}>
            This manifest combines your proxy wishlist with cards from friends who have explicitly granted you permission to order proxies for them. Friends configure this permission in their <strong>Friends Settings</strong>.
          </p>
        </div>

        <button
          onClick={loadQueue}
          disabled={loading}
          style={{
            backgroundColor: "#0f172a",
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

      {/* Authorized Friends Chips */}
      <div
        style={{
          backgroundColor: "#0f172a",
          border: "1px solid #334155",
          borderRadius: "10px",
          padding: "1rem",
          display: "flex",
          flexDirection: "column",
          gap: "0.5rem",
        }}
      >
        <div style={{ fontSize: "0.85rem", fontWeight: 600, color: "#94a3b8", display: "flex", alignItems: "center", gap: "6px" }}>
          <ShieldCheckIcon style={{ width: "16px", height: "16px", color: "#10b981" }} />
          Participating Authorized Friends ({friends.length}):
        </div>
        {friends.length === 0 ? (
          <div style={{ fontSize: "0.82rem", color: "#64748b" }}>
            No friends have authorized you to order proxies for them yet. Friends can enable "Allow Proxy Orders" for you in their Friends Settings to have their wishlist pooled here.
          </div>
        ) : (
          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
            {friends.map((f) => (
              <span
                key={f.id}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  backgroundColor: "#1e293b",
                  border: "1px solid #475569",
                  borderRadius: "20px",
                  padding: "0.25rem 0.75rem",
                  fontSize: "0.82rem",
                  color: "#f8fafc",
                }}
              >
                {f.avatar_url ? (
                  <img src={f.avatar_url} alt={f.username} style={{ width: "18px", height: "18px", borderRadius: "50%" }} />
                ) : (
                  <UserCircleIcon style={{ width: "18px", height: "18px", color: "#94a3b8" }} />
                )}
                <span>{f.username}</span>
                <span style={{ color: "#10b981", fontSize: "0.75rem", fontWeight: 600 }}>Authorized</span>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Order Summary & MPC Tier Stats */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
          gap: "1rem",
        }}
      >
        {/* Card count & cost widget */}
        <div
          style={{
            backgroundColor: "#1e293b",
            border: "1px solid #334155",
            borderRadius: "10px",
            padding: "1.25rem",
            display: "flex",
            flexDirection: "column",
            gap: "0.75rem",
          }}
        >
          <div style={{ fontSize: "0.85rem", color: "#94a3b8", fontWeight: 600 }}>Manifest Summary</div>
          <div style={{ display: "flex", alignItems: "baseline", gap: "0.5rem" }}>
            <span style={{ fontSize: "2rem", fontWeight: 700, color: "#f8fafc" }}>{totalCardsCount}</span>
            <span style={{ color: "#94a3b8", fontSize: "0.9rem" }}>total cards pooled</span>
          </div>

          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderTop: "1px solid #334155", paddingTop: "0.75rem" }}>
            <span style={{ fontSize: "0.85rem", color: "#94a3b8" }}>Unit Print Cost:</span>
            <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
              <span style={{ color: "#f8fafc", fontSize: "0.85rem" }}>$</span>
              <input
                type="number"
                step="0.01"
                min="0.10"
                max="1.00"
                value={unitCost}
                onChange={(e) => setUnitCost(parseFloat(e.target.value) || 0.25)}
                style={{
                  width: "60px",
                  padding: "2px 6px",
                  backgroundColor: "#0f172a",
                  border: "1px solid #475569",
                  borderRadius: "4px",
                  color: "#f8fafc",
                  fontSize: "0.85rem",
                  textAlign: "right",
                }}
              />
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontSize: "0.85rem", color: "#94a3b8" }}>Total Order Estimate:</span>
            <span style={{ fontSize: "1.1rem", fontWeight: 700, color: "#34d399" }}>${totalCost}</span>
          </div>
        </div>

        {/* Cost per participant widget */}
        <div
          style={{
            backgroundColor: "#1e293b",
            border: "1px solid #334155",
            borderRadius: "10px",
            padding: "1.25rem",
            display: "flex",
            flexDirection: "column",
            gap: "0.5rem",
          }}
        >
          <div style={{ fontSize: "0.85rem", color: "#94a3b8", fontWeight: 600, display: "flex", alignItems: "center", gap: "6px" }}>
            <BanknotesIcon style={{ width: "16px", height: "16px", color: "#34d399" }} /> Cost Share Breakdown
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem", maxHeight: "120px", overflowY: "auto" }}>
            {Object.entries(userBreakdown).map(([uname, data]) => (
              <div key={uname} style={{ display: "flex", justifyContent: "space-between", fontSize: "0.85rem" }}>
                <span style={{ color: uname === "You" ? "#38bdf8" : "#f8fafc", fontWeight: uname === "You" ? 600 : 400 }}>
                  {uname}: {data.count} cards
                </span>
                <span style={{ fontWeight: 600, color: "#34d399" }}>${data.cost.toFixed(2)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Manifest Action Buttons */}
      <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", alignItems: "center" }}>
        <button
          onClick={handleCopyMpcList}
          disabled={displayedCards.length === 0}
          style={{
            backgroundColor: "#4f46e5",
            color: "#ffffff",
            border: "none",
            borderRadius: "8px",
            padding: "0.6rem 1rem",
            fontWeight: 600,
            fontSize: "0.88rem",
            cursor: displayedCards.length === 0 ? "not-allowed" : "pointer",
            opacity: displayedCards.length === 0 ? 0.5 : 1,
            display: "flex",
            alignItems: "center",
            gap: "0.4rem",
          }}
        >
          <ClipboardDocumentListIcon style={{ width: "16px", height: "16px" }} /> Copy MPC Text
        </button>

        <button
          onClick={handleDownloadCsv}
          disabled={displayedCards.length === 0}
          style={{
            backgroundColor: "#1e293b",
            color: "#f8fafc",
            border: "1px solid #475569",
            borderRadius: "8px",
            padding: "0.6rem 1rem",
            fontWeight: 600,
            fontSize: "0.88rem",
            cursor: displayedCards.length === 0 ? "not-allowed" : "pointer",
            opacity: displayedCards.length === 0 ? 0.5 : 1,
            display: "flex",
            alignItems: "center",
            gap: "0.4rem",
          }}
        >
          <DocumentArrowDownIcon style={{ width: "16px", height: "16px" }} /> Download CSV
        </button>

        <button
          onClick={handleConfirmOrder}
          disabled={queueCards.length === 0 || confirmingOrder}
          style={{
            backgroundColor: "#059669",
            color: "#ffffff",
            border: "none",
            borderRadius: "8px",
            padding: "0.6rem 1.25rem",
            fontWeight: 600,
            fontSize: "0.88rem",
            cursor: queueCards.length === 0 || confirmingOrder ? "not-allowed" : "pointer",
            opacity: queueCards.length === 0 || confirmingOrder ? 0.5 : 1,
            display: "flex",
            alignItems: "center",
            gap: "0.4rem",
            marginLeft: "auto",
          }}
        >
          <CheckCircleIcon style={{ width: "18px", height: "18px" }} />
          {confirmingOrder ? "Finalizing Order..." : "Confirm & Save Order"}
        </button>
      </div>

      {/* Filter and Cards Table */}
      <div
        style={{
          backgroundColor: "#1e293b",
          border: "1px solid #334155",
          borderRadius: "12px",
          padding: "1rem",
          display: "flex",
          flexDirection: "column",
          gap: "1rem",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "0.5rem" }}>
          <h3 style={{ margin: 0, fontSize: "1rem", fontWeight: 600, color: "#f8fafc" }}>
            Cards in Manifest ({displayedCards.length})
          </h3>

          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <span style={{ fontSize: "0.82rem", color: "#94a3b8" }}>Filter by owner:</span>
            <select
              value={selectedUserFilter}
              onChange={(e) => setSelectedUserFilter(e.target.value)}
              style={{
                backgroundColor: "#0f172a",
                border: "1px solid #475569",
                borderRadius: "6px",
                padding: "0.3rem 0.6rem",
                color: "#f8fafc",
                fontSize: "0.82rem",
                outline: "none",
              }}
            >
              <option value="all">All Participants</option>
              <option value="me">My Wishlist Cards</option>
              {friends.map((f) => (
                <option key={f.id} value={f.id}>{f.username}</option>
              ))}
            </select>
          </div>
        </div>

        {loading ? (
          <div style={{ textAlign: "center", padding: "2rem", color: "#64748b" }}>Loading proxy queue...</div>
        ) : displayedCards.length === 0 ? (
          <div style={{ textAlign: "center", padding: "2rem", color: "#94a3b8", fontSize: "0.9rem" }}>
            No cards found for the selected filter.
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid #334155", textAlign: "left", color: "#94a3b8" }}>
                  <th style={{ padding: "0.5rem" }}>Card Name</th>
                  <th style={{ padding: "0.5rem" }}>Owner</th>
                  <th style={{ padding: "0.5rem" }}>Qty</th>
                  <th style={{ padding: "0.5rem" }}>Set</th>
                  <th style={{ padding: "0.5rem" }}>List Type</th>
                  <th style={{ padding: "0.5rem", textAlign: "right" }}>Market Price</th>
                </tr>
              </thead>
              <tbody>
                {displayedCards.map((c, idx) => (
                  <tr
                    key={`${c.id}-${idx}`}
                    style={{
                      borderBottom: "1px solid #243247",
                      backgroundColor: idx % 2 === 0 ? "rgba(15, 23, 42, 0.4)" : "transparent",
                    }}
                  >
                    <td style={{ padding: "0.5rem", color: "#f8fafc", fontWeight: 500 }}>{c.card_name}</td>
                    <td style={{ padding: "0.5rem", color: c.user_id === user?.id ? "#38bdf8" : "#a855f7" }}>
                      {c.username || "You"}
                    </td>
                    <td style={{ padding: "0.5rem", color: "#f8fafc" }}>{c.quantity || 1}</td>
                    <td style={{ padding: "0.5rem", color: "#94a3b8", textTransform: "uppercase" }}>{c.set_code || "—"}</td>
                    <td style={{ padding: "0.5rem", color: "#94a3b8" }}>
                      <span
                        style={{
                          fontSize: "0.75rem",
                          padding: "2px 6px",
                          borderRadius: "4px",
                          backgroundColor: c.list_type === "wishlist" ? "#312e81" : "#1e293b",
                          color: c.list_type === "wishlist" ? "#a5b4fc" : "#94a3b8",
                        }}
                      >
                        {c.list_type === "wishlist" ? "Wishlist" : "Optional"}
                      </span>
                    </td>
                    <td style={{ padding: "0.5rem", textAlign: "right", color: "#34d399", fontWeight: 500 }}>
                      {typeof c.market_price === "number" ? `$${c.market_price.toFixed(2)}` : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
