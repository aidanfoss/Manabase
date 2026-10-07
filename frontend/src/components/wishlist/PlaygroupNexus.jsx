import React, { useState, useEffect } from "react";
import { UserGroupIcon, LinkIcon, ArrowRightOnRectangleIcon, SparklesIcon, RocketLaunchIcon, LockClosedIcon, BanknotesIcon, ArrowPathIcon, WrenchScrewdriverIcon, ClipboardDocumentListIcon, CheckCircleIcon } from "@heroicons/react/24/solid";
import { api } from "../../api/client";
import { useToast } from "../../context/ToastContext";
import { useWishlist } from "../../context/WishlistProvider";

export default function PlaygroupNexus({ loadPlaygroups, handleSaveCardBack }) {
  const {
    activeGroup, setActiveGroup,
    groupWishlist, setGroupWishlist,
    mpcUnitCost, setMpcUnitCost,
    defaultCardBack
  } = useWishlist();
  const { showToast } = useToast();
  const [groupMembers, setGroupMembers] = useState([]);
  const [resyncingGroupDecks, setResyncingGroupDecks] = useState(false);
  const [manifestOptedOut, setManifestOptedOut] = useState(true);
  const [togglingOptOut, setTogglingOptOut] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");

  useEffect(() => {
    if (activeGroup) {
      loadPlaygroupDetails(activeGroup.id);
    } else {
      setGroupMembers([]);
      setGroupWishlist([]);
    }
  }, [activeGroup]);

  const loadPlaygroupDetails = async (groupId) => {
    try {
      const token = localStorage.getItem("token");
      if (!token) return;

      const membersRes = await fetch(`/api/playgroups/${groupId}/members`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (membersRes.ok) {
        const membersData = await membersRes.json();
        setGroupMembers(membersData);
        try {
          const payload = JSON.parse(atob(token.split(".")[1]));
          const myMembership = membersData.find(m => m.id === payload.id || m.id === payload.userId || m.id === payload.sub);
          if (myMembership) {
            setManifestOptedOut(!!myMembership.opted_out_of_manifest);
          }
        } catch (_) { }
      }

      const wishlistRes = await fetch(`/api/playgroups/${groupId}/wishlist`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (wishlistRes.ok) setGroupWishlist(await wishlistRes.json());
    } catch (e) {
      console.error("Failed to fetch playgroup info:", e);
    }
  };

  const handleToggleManifestOptOut = async () => {
    if (!activeGroup) return;
    const newOptedOut = !manifestOptedOut;
    setTogglingOptOut(true);
    try {
      await api.toggleManifestOptOut(activeGroup.id, newOptedOut);
      setManifestOptedOut(newOptedOut);
      await loadPlaygroupDetails(activeGroup.id);
      showToast(
        newOptedOut
          ? "You've opted OUT of the proxy manifest."
          : "You've opted IN to the proxy manifest.",
        newOptedOut ? "warning" : "success"
      );
    } catch (e) {
      showToast("Failed to update manifest opt-out setting.", "error");
    } finally {
      setTogglingOptOut(false);
    }
  };

  const handleResyncGroupDecks = async () => {
    if (!activeGroup) return;
    setResyncingGroupDecks(true);
    try {
      const res = await api.resyncPlaygroupDecks(activeGroup.id);
      alert(`${res.message}`);
      loadPlaygroupDetails(activeGroup.id);
    } catch (err) {
      alert("Failed to resync playgroup decks: " + err.message);
    } finally {
      setResyncingGroupDecks(false);
    }
  };

  const handleCreateGroup = async () => {
    if (!newGroupName.trim()) return;
    try {
      const token = localStorage.getItem("token");
      const res = await fetch("/api/playgroups", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ name: newGroupName.trim() })
      });
      if (res.ok) {
        const newGroup = await res.json();
        setNewGroupName("");
        loadPlaygroups();
        setActiveGroup(newGroup);
        alert(`Success! Created playgroup "${newGroup.name}"`);
      }
    } catch (e) {
      console.error("Failed to create playgroup:", e);
    }
  };

  const handleGenerateInviteLink = async () => {
    if (!activeGroup) return;
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`/api/playgroups/${activeGroup.id}/invite`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        const url = `${window.location.origin}/invite/${data.token}`;
        await navigator.clipboard.writeText(url);
        showToast(`Playgroup invite link copied to clipboard!`, "success");
      } else {
        const err = await res.json();
        showToast(`Failed to generate invite link: ${err.error}`, "error");
      }
    } catch (e) {
      console.error("Failed to generate invite link:", e);
      showToast("Failed to generate invite link.", "error");
    }
  };

  const handleLeaveGroup = async () => {
    if (!activeGroup) return;
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`/api/playgroups/${activeGroup.id}/leave`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        showToast(data.message || `Left playgroup "${activeGroup.name}"`, "info");
        // Need to update the list of playgroups
        loadPlaygroups();
        setActiveGroup(null);
      } else {
        const err = await res.json();
        showToast(`Failed to leave playgroup: ${err.error}`, "error");
      }
    } catch (e) {
      console.error("Failed to leave playgroup:", e);
      showToast("Failed to leave playgroup.", "error");
    }
  };

  const mpcActiveCards = groupWishlist.slice(0, 612);
  const venmoUserCounts = {};
  mpcActiveCards.forEach(c => {
    venmoUserCounts[c.username] = (venmoUserCounts[c.username] || 0) + 1;
  });

  const totalEstimateCost = mpcActiveCards.length * mpcUnitCost;

  return (
    <div className="playgroup-nexus-workspace">
      <h2><UserGroupIcon className="inline-icon" style={{ width: '1.2em', height: '1.2em', verticalAlign: 'middle', marginRight: '4px' }} /> Playgroup Nexus</h2>

      {/* Manifest participation control */}
      <button
        onClick={handleToggleManifestOptOut}
        disabled={!activeGroup || togglingOptOut}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "0.35rem",
          padding: "0.25rem 0.65rem",
          borderRadius: "999px",
          fontSize: "0.75rem",
          fontWeight: 700,
          cursor: (!activeGroup || togglingOptOut) ? "not-allowed" : "pointer",
          opacity: (!activeGroup || togglingOptOut) ? 0.55 : 1,
          border: `1px solid ${manifestOptedOut ? "rgba(245,158,11,0.5)" : "rgba(52,211,153,0.4)"}`,
          background: manifestOptedOut ? "rgba(146,64,14,0.25)" : "rgba(6,78,59,0.25)",
          color: manifestOptedOut ? "#fbbf24" : "#34d399",
          transition: "all 0.15s ease",
          whiteSpace: "nowrap",
          flexShrink: 0,
        }}
      >
        {togglingOptOut ? "..." : manifestOptedOut ? "Not Opted Out" : "Active Opted In"}
      </button>

      {/* Venmo Calculator section */}
      <div className="venmo-calculator-card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <h4 style={{ margin: "0", fontSize: "1rem" }}><BanknotesIcon className="inline-icon" style={{ width: '1.2em', height: '1.2em', verticalAlign: 'middle', marginRight: '4px' }} /> Venmo Reimbursement Calculator</h4>
            <p style={{ margin: "0.15rem 0 0 0", fontSize: "0.78rem", color: "#64748b" }}>
              Costs split proportionally according to card count percentage in the active 612 manifest.
            </p>
          </div>

          {/* Cost config */}
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <span style={{ fontSize: "0.8rem", color: "#cbd5e1" }}>Cost per print card:</span>
            <input
              type="number"
              step="0.01"
              value={mpcUnitCost}
              onChange={(e) => setMpcUnitCost(parseFloat(e.target.value) || 0)}
              className="setup-input"
              style={{ width: "70px", padding: "0.3rem" }}
            />
          </div>
        </div>

        <div className="venmo-grid">
          {Object.entries(venmoUserCounts).map(([username, count]) => {
            const pct = mpcActiveCards.length > 0 ? (count / mpcActiveCards.length) * 100 : 0;
            const shareVal = (pct / 100) * totalEstimateCost;
            return (
              <div key={username} className="venmo-user-card">
                <div>
                  <span className="venmo-user-name">{username}</span>
                  <div className="venmo-user-stats">{count} cards ({pct.toFixed(1)}% of manifest)</div>
                </div>
                <span className="venmo-price-share">${shareVal.toFixed(2)}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
