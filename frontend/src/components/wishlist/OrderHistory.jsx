import React, { useState } from "react";
import { ClockIcon, ArrowPathIcon, ArrowsRightLeftIcon } from "@heroicons/react/24/solid";
import { useWishlist } from "../../context/WishlistProvider";
import { useToast } from "../../context/ToastContext";

export default function OrderHistory() {
  const {
    orderHistory,
    loadingHistory,
    loadLists,
    activeGroup
  } = useWishlist();

  const { showToast } = useToast();
  const [expandedOrderId, setExpandedOrderId] = useState(null);

  // Directly grab loadOrderHistory here instead of pulling from context,
  // wait, loadOrderHistory is probably better managed in context, but let's just
  // expose it from context or fetch it here.
  // In WishlistHub, they had `loadOrderHistory()`. It should be in context. Let's add it to context.
  // Actually, I can just fetch it here! It makes this component autonomous.
  const { setOrderHistory, setLoadingHistory } = useWishlist();

  const loadOrderHistory = async () => {
    setLoadingHistory(true);
    try {
      const token = localStorage.getItem("token");
      if (!token) return;
      const res = await fetch("/api/proxy-orders/history", {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setOrderHistory(data || []);
      }
    } catch (err) {
      console.error("Failed to load order history:", err);
    } finally {
      setLoadingHistory(false);
    }
  };

  const handleRestoreOrder = async (orderId) => {
    const token = localStorage.getItem("token");
    if (!token) return;
    try {
      const res = await fetch(`/api/proxy-orders/${orderId}/restore`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        showToast(data.message || "Order restored to wishlist!", "success");
        await loadLists();
        // If Playgroup needs a reload, that can be triggered here or in loadLists
      } else {
        const errData = await res.json();
        alert(errData.error || "Failed to restore order.");
      }
    } catch (e) {
      console.error("Restore order error:", e);
      alert("Failed to restore order.");
    }
  };

  const handleMoveToTradelist = async (orderId) => {
    const token = localStorage.getItem("token");
    if (!token) return;
    try {
      const res = await fetch(`/api/proxy-orders/${orderId}/move-to-tradelist`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        showToast(data.message || "Added cards from order to tradelist!", "success");
      } else {
        const errData = await res.json();
        alert(errData.error || "Failed to move cards to tradelist.");
      }
    } catch (e) {
      console.error("Move to tradelist error:", e);
      alert("Failed to move cards to tradelist.");
    }
  };

  return (
    <div className="proxy-settings-container">
      <div className="settings-card">
        <div className="settings-card-header">
          <h3 className="settings-card-title">
            <ClockIcon className="inline-icon" style={{ width: '1.2em', height: '1.2em', verticalAlign: 'middle', marginRight: '4px' }} /> Proxy Order History
          </h3>
          <button
            className="setup-btn"
            style={{ fontSize: "0.8rem", padding: "0.3rem 0.75rem" }}
            onClick={loadOrderHistory}
            disabled={loadingHistory}
          >
            <ArrowPathIcon className="inline-icon" style={{ width: '1.2em', height: '1.2em', verticalAlign: 'middle', marginRight: '4px' }} /> {loadingHistory ? "Refreshing..." : "Refresh"}
          </button>
        </div>
        <p style={{ color: "#94a3b8", fontSize: "0.85rem", marginTop: 0 }}>
          View past confirmed proxy orders, restore order cards back to wishlists, or add ordered cards to your tradelist.
        </p>

        {loadingHistory ? (
          <div style={{ color: "#94a3b8", padding: "2rem", textAlign: "center" }}>Loading order history...</div>
        ) : orderHistory.length === 0 ? (
          <div className="empty-wishlist-box">
            No past orders found. When you confirm an order from My Lists or Playgroup Nexus, it will appear here.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem", marginTop: "1rem" }}>
            {orderHistory.map((order) => {
              const isExpanded = expandedOrderId === order.id;
              const orderCards = Array.isArray(order.cards) ? order.cards : [];
              const dateStr = new Date(order.created_at).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit"
              });

              return (
                <div
                  key={order.id}
                  style={{
                    background: "rgba(15,23,42,0.8)",
                    border: "1px solid rgba(255,255,255,0.08)",
                    borderRadius: "10px",
                    padding: "1.25rem"
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "1rem" }}>
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                        <h4 style={{ margin: 0, fontSize: "1.1rem", color: "#f8fafc" }}>
                          {order.title || `Order #${order.id}`}
                        </h4>
                        <span
                          style={{
                            background: "rgba(6,78,59,0.4)",
                            color: "#34d399",
                            border: "1px solid rgba(52,211,153,0.3)",
                            fontSize: "0.72rem",
                            padding: "0.15rem 0.5rem",
                            borderRadius: "4px",
                            fontWeight: "700",
                            textTransform: "uppercase"
                          }}
                        >
                          Confirmed
                        </span>
                      </div>
                      <p style={{ margin: "0.3rem 0 0 0", fontSize: "0.82rem", color: "#94a3b8" }}>
                        Ordered on <strong>{dateStr}</strong> by <strong>{order.creator_username || "User"}</strong> {order.playgroup_name ? ` Playgroup: ${order.playgroup_name}` : " Personal Wishlist"}
                      </p>
                      <div style={{ display: "flex", gap: "1rem", marginTop: "0.5rem", fontSize: "0.85rem", color: "#cbd5e1" }}>
                        <span><strong>{order.total_cards}</strong> total cards</span>
                        <span>Est. cost: <strong style={{ color: "#34d399" }}>${Number(order.total_cost || 0).toFixed(2)}</strong></span>
                      </div>
                    </div>

                    <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                      <button
                        className="setup-btn"
                        style={{ background: "rgba(59,130,246,0.15)", border: "1px solid rgba(59,130,246,0.4)", color: "#93c5fd", fontSize: "0.8rem" }}
                        onClick={() => handleRestoreOrder(order.id)}
                        title="Re-add all cards from this order back into your proxy wishlist"
                      >
                        <ArrowPathIcon className="inline-icon" style={{ width: '1.2em', height: '1.2em', verticalAlign: 'middle', marginRight: '4px' }} /> Restore to Wishlist
                      </button>

                      <button
                        className="setup-btn"
                        style={{ background: "rgba(168,85,247,0.15)", border: "1px solid rgba(168,85,247,0.4)", color: "#c084fc", fontSize: "0.8rem" }}
                        onClick={() => handleMoveToTradelist(order.id)}
                        title="Add all cards from this order to your tradelist"
                      >
                        <ArrowsRightLeftIcon className="inline-icon" style={{ width: '1.2em', height: '1.2em', verticalAlign: 'middle', marginRight: '4px' }} /> Add to Tradelist
                      </button>

                      <button
                        className="setup-btn"
                        style={{ background: "transparent", border: "1px solid rgba(255,255,255,0.15)", color: "#94a3b8", fontSize: "0.8rem" }}
                        onClick={() => setExpandedOrderId(isExpanded ? null : order.id)}
                      >
                        {isExpanded ? "Hide Cards " : `View Cards (${orderCards.length}) `}
                      </button>
                    </div>
                  </div>

                  {/* Collapsible cards list */}
                  {isExpanded && (
                    <div style={{ marginTop: "1rem", borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: "0.75rem" }}>
                      <h5 style={{ margin: "0 0 0.5rem 0", fontSize: "0.85rem", color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                        Cards in this Order ({orderCards.length} unique)
                      </h5>
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: "0.5rem" }}>
                        {orderCards.map((c, idx) => (
                          <div
                            key={idx}
                            style={{
                              background: "rgba(30,41,59,0.5)",
                              padding: "0.4rem 0.6rem",
                              borderRadius: "6px",
                              fontSize: "0.8rem",
                              display: "flex",
                              justifyContent: "space-between",
                              alignItems: "center"
                            }}
                          >
                            <span>
                              <strong>{c.quantity || 1}x</strong> {c.card_name} {c.is_foil && <span style={{ color: "#f59e0b", fontSize: "0.7rem" }}> (Foil)</span>}
                            </span>
                            {c.username && <span style={{ color: "#64748b", fontSize: "0.72rem" }}>{c.username}</span>}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
