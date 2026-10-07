import React, { useState, useEffect } from "react";
import {
  UserGroupIcon,
  LinkIcon,
  ArrowRightOnRectangleIcon,
  PrinterIcon,
  CurrencyDollarIcon,
  PaintBrushIcon
} from "@heroicons/react/24/solid";
import { useWishlist } from "../../context/WishlistProvider";
import { useToast } from "../../context/ToastContext";
import { api } from "../../api/client";

export default function ProxySettings() {
  const {
    activeGroup,
    setActiveGroup,
    playgroups,
    setPlaygroups,
    mpcUnitCost,
    setMpcUnitCost,
    defaultCardBack,
    setDefaultCardBack,
    prebuiltCardbacks,
    groupWishlist
  } = useWishlist();

  const { showToast } = useToast();
  const [newGroupName, setNewGroupName] = useState("");
  const [manifestOptedOut, setManifestOptedOut] = useState(true);
  const [togglingOptOut, setTogglingOptOut] = useState(false);
  const [groupMembers, setGroupMembers] = useState([]);

  // Local helper for refreshing playgroups list
  const loadPlaygroups = async () => {
    try {
      const token = localStorage.getItem("token");
      if (!token) return;
      const res = await fetch("/api/playgroups", {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setPlaygroups(data || []);
      }
    } catch (e) {
      console.error("Failed to load playgroups:", e);
    }
  };

  // Determine opt out state specific to this component when activeGroup changes
  useEffect(() => {
    if (activeGroup) {
      loadPlaygroupDetails(activeGroup.id);
    } else {
      setGroupMembers([]);
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
    } catch (e) {
      console.error("Failed to fetch playgroup info:", e);
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

  const handleSaveCardBack = async (newVal) => {
    setDefaultCardBack(newVal);
    localStorage.setItem("manabase_default_card_back", newVal);
    const token = localStorage.getItem("token");
    if (!token) return;
    try {
      await fetch("/api/users/me/card-back", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ default_card_back: newVal })
      });
    } catch (e) {
      console.error("Failed to save default card back:", e);
    }
  };

  const mpcActiveCards = groupWishlist.slice(0, 612);

  return (
    <div className="proxy-settings-container">
      {/* Card 1: Active Playgroup Selection */}
      <div className="settings-card">
        <div className="settings-card-header">
          <h3 className="settings-card-title">
            <UserGroupIcon className="inline-icon" style={{ width: '1.2em', height: '1.2em', verticalAlign: 'middle', marginRight: '4px' }} /> Active Playgroup Selection
          </h3>
          {activeGroup && (
            <span className="mpc-alert-badge met">
              Current: {activeGroup.name}
            </span>
          )}
        </div>
        <p style={{ color: "#94a3b8", fontSize: "0.85rem", marginTop: 0 }}>
          Select which playgroup is currently active for shared wishlist calculation and proxy manifests.
        </p>

        <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap", alignItems: "center", marginBottom: "1rem" }}>
          <label style={{ fontSize: "0.9rem", fontWeight: "600", color: "#cbd5e1" }}>Active Playgroup:</label>
          <select
            className="setup-input"
            style={{ minWidth: "220px" }}
            value={activeGroup?.id || ""}
            onChange={(e) => {
              const sel = playgroups.find((g) => g.id === e.target.value);
              if (sel) setActiveGroup(sel);
            }}
          >
            {playgroups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name} ({g.member_count || 1} members)
              </option>
            ))}
            {playgroups.length === 0 && <option value="">No playgroups joined</option>}
          </select>
        </div>

        <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: "1rem", display: "flex", gap: "1rem", flexWrap: "wrap" }}>
          <div style={{ flex: 1, minWidth: "240px" }}>
            <h4 style={{ margin: "0 0 0.5rem 0", fontSize: "0.9rem", color: "#e2e8f0" }}>Create New Playgroup</h4>
            <div style={{ display: "flex", gap: "0.5rem" }}>
              <input
                type="text"
                value={newGroupName}
                onChange={(e) => setNewGroupName(e.target.value)}
                placeholder="New playgroup name..."
                className="setup-input"
                style={{ flex: 1 }}
              />
              <button onClick={handleCreateGroup} className="setup-btn">Create</button>
            </div>
          </div>

          <div style={{ flex: 1, minWidth: "240px" }}>
            <h4 style={{ margin: "0 0 0.5rem 0", fontSize: "0.9rem", color: "#e2e8f0" }}>Manage Group Access</h4>
            <p style={{ margin: "0 0 0.75rem 0", fontSize: "0.8rem", color: "#94a3b8" }}>
              Invite friends via link or leave this playgroup.
            </p>
            <div style={{ display: "flex", gap: "0.5rem" }}>
              <button
                onClick={handleGenerateInviteLink}
                className="setup-btn"
                style={{ background: "#3b82f6", flex: 1 }}
                disabled={!activeGroup}
              >
                <LinkIcon className="inline-icon" style={{ width: '1.2em', height: '1.2em', verticalAlign: 'middle', marginRight: '4px' }} /> Copy Invite Link
              </button>
              <button
                onClick={handleLeaveGroup}
                className="setup-btn"
                style={{ background: "transparent", border: "1px solid #ef4444", color: "#f87171" }}
                disabled={!activeGroup}
              >
                <ArrowRightOnRectangleIcon className="inline-icon" style={{ width: '1.2em', height: '1.2em', verticalAlign: 'middle', marginRight: '4px' }} /> Leave Group
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Card 1.5: Proxy Manifest Participation */}
      <div className="settings-card" style={{ border: manifestOptedOut ? "1px solid rgba(245,158,11,0.35)" : "1px solid rgba(52,211,153,0.25)" }}>
        <div className="settings-card-header">
          <h3 className="settings-card-title">
            <PrinterIcon className="inline-icon" style={{ width: '1.2em', height: '1.2em', verticalAlign: 'middle', marginRight: '4px' }} /> Proxy Manifest Participation
          </h3>
          <span
            className="mpc-alert-badge"
            style={{
              background: manifestOptedOut ? "rgba(146,64,14,0.3)" : "rgba(6,78,59,0.3)",
              color: manifestOptedOut ? "#fbbf24" : "#34d399",
              border: `1px solid ${manifestOptedOut ? "rgba(245,158,11,0.4)" : "rgba(52,211,153,0.4)"}`
            }}
          >
            {manifestOptedOut ? "Not  Opted Out" : "Active  Opted In"}
          </span>
        </div>
        <p style={{ color: "#94a3b8", fontSize: "0.85rem", marginTop: 0 }}>
          Determine whether your personal proxy wishlist is included in the active playgroup's combined export manifest. If opted out, your cards are ignored when generating the MPCfill print file.
        </p>

        <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap", alignItems: "center" }}>
          <button
            onClick={handleToggleManifestOptOut}
            disabled={!activeGroup || togglingOptOut}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.5rem",
              padding: "0.45rem 1rem",
              borderRadius: "6px",
              fontSize: "0.85rem",
              fontWeight: 600,
              cursor: (!activeGroup || togglingOptOut) ? "not-allowed" : "pointer",
              opacity: (!activeGroup || togglingOptOut) ? 0.6 : 1,
              border: `1px solid ${manifestOptedOut ? "rgba(245,158,11,0.5)" : "rgba(52,211,153,0.4)"}`,
              background: manifestOptedOut ? "rgba(146,64,14,0.2)" : "rgba(6,78,59,0.2)",
              color: manifestOptedOut ? "#fbbf24" : "#34d399",
              transition: "all 0.15s ease",
              width: "auto"
            }}
            title={!activeGroup ? "Select an active playgroup first" : ""}
          >
            {togglingOptOut
              ? "Saving..."
              : manifestOptedOut
                ? "Active  Opt In to Proxy Manifest"
                : "Not  Opt Out of Proxy Manifest"
            }
          </button>

          {!activeGroup && (
            <p style={{ fontSize: "0.78rem", color: "#64748b", marginTop: "0.5rem" }}>
              Select an active playgroup above to manage your manifest participation.
            </p>
          )}
        </div>
      </div>

      {/* Card 2: Playgroup Cost Per Proxy */}
      <div className="settings-card">
        <div className="settings-card-header">
          <h3 className="settings-card-title"><CurrencyDollarIcon className="inline-icon" style={{ width: '1.2em', height: '1.2em', verticalAlign: 'middle', marginRight: '4px' }} /> Playgroup Cost per Proxy</h3>
          <span className="mpc-alert-badge met" style={{ background: "rgba(59, 130, 246, 0.15)", color: "#93c5fd" }}>
            Estimated Cost: ${(mpcActiveCards.length * mpcUnitCost).toFixed(2)}
          </span>
        </div>
        <p style={{ color: "#94a3b8", fontSize: "0.85rem", marginTop: 0 }}>
          Set your target per-card print cost for MakePlayingCards orders (default is $0.25/card).
        </p>

        <div style={{ display: "flex", alignItems: "center", gap: "1rem", flexWrap: "wrap" }}>
          <label style={{ fontSize: "0.9rem", fontWeight: "600", color: "#cbd5e1" }}>Cost Per Proxy ($):</label>
          <input
            type="number"
            step="0.01"
            min="0"
            value={mpcUnitCost}
            onChange={(e) => setMpcUnitCost(parseFloat(e.target.value) || 0)}
            className="setup-input"
            style={{ width: "120px" }}
          />
          <span style={{ fontSize: "0.85rem", color: "#64748b" }}>
            (Calculates individual member cost splitting for {mpcActiveCards.length} total active cards)
          </span>
        </div>
      </div>

      {/* Card 3: Individual Cardback Options & Prebuilt Defaults */}
      <div className="settings-card">
        <div className="settings-card-header">
          <h3 className="settings-card-title"><PaintBrushIcon className="inline-icon" style={{ width: '1.2em', height: '1.2em', verticalAlign: 'middle', marginRight: '4px' }} /> Individual Cardback Preferences</h3>
          {defaultCardBack && (
            <span className="mpc-alert-badge met" style={{ background: "rgba(16, 185, 129, 0.15)" }}>
              Active Cardback Selected
            </span>
          )}
        </div>
        <p style={{ color: "#94a3b8", fontSize: "0.85rem", marginTop: 0 }}>
          Choose your default cardback for proxy orders. Pick from prebuilt defaults below or input a custom Google Drive ID / search query string.
        </p>

        {/* Custom Input */}
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap", marginBottom: "1.25rem" }}>
          <label style={{ fontSize: "0.9rem", fontWeight: "600", color: "#cbd5e1", whiteSpace: "nowrap" }}>
            Custom ID / Query String:
          </label>
          <input
            type="text"
            className="setup-input"
            style={{ flex: 1, minWidth: "260px" }}
            placeholder="e.g. Google Drive ID, image URL, or search query (e.g. b:black lotus)"
            value={defaultCardBack}
            onChange={(e) => handleSaveCardBack(e.target.value)}
          />
          {defaultCardBack && (
            <button
              className="btn-secondary"
              onClick={() => handleSaveCardBack("")}
              style={{ padding: "0.4rem 0.75rem" }}
            >
              Clear Selection
            </button>
          )}
        </div>

        {/* Prebuilt Cardbacks Grid */}
        <h4 style={{ margin: "1rem 0 0.5rem 0", fontSize: "0.95rem", color: "#f1f5f9" }}>
          Prebuilt Cardback Defaults ({prebuiltCardbacks.length}):
        </h4>
        <div className="cardback-grid">
          {prebuiltCardbacks.map((cb) => {
            const isSelected =
              (cb.driveId && defaultCardBack === cb.driveId) ||
              (cb.query && defaultCardBack === cb.query) ||
              (cb.id && defaultCardBack === cb.id);

            return (
              <div
                key={cb.id}
                className={`cardback-option-card ${isSelected ? "selected" : ""}`}
                onClick={() => handleSaveCardBack(cb.driveId || cb.query || cb.name)}
              >
                {isSelected && <span className="cardback-selected-badge"> Active</span>}
                <div className="cardback-preview-wrapper">
                  <img
                    src={cb.previewUrl || "https://cards.scryfall.io/card_back.png"}
                    alt={cb.name}
                    className="cardback-preview-img"
                    onError={(e) => { e.target.src = "https://cards.scryfall.io/card_back.png"; }}
                  />
                </div>
                <div className="cardback-name">{cb.name}</div>
                <div className="cardback-author">{cb.author || "Default"}</div>
                <div className="cardback-dpi">{cb.dpi || "800 DPI"}</div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}