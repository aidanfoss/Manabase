import React, { useMemo } from "react";
import ColorSelector from "./ColorSelector";
import MetaSelector from "./PackageSelector";
import LandCycleSelector from "./LandCycleSelector";
import { useAuth } from "../context/AuthContext";

export default function Sidebar({
  metas,
  landcycles,
  selected,
  toggle,
  collapsed,
  setCollapsed,
}) {
  const { user, logout } = useAuth();

  const groupedLandcycles = useMemo(() => {
    const groups = { premium: [], playable: [], budget: [], terrible: [] };
    for (const lc of landcycles) {
      const tier = lc.tier?.toLowerCase() || "budget";
      if (groups[tier]) groups[tier].push(lc);
      else groups.budget.push(lc);
    }
    for (const tier in groups) {
      groups[tier].sort((a, b) => a.name.localeCompare(b.name));
    }
    return groups;
  }, [landcycles]);

  function copyShareLink() {
    const shareUrl = window.location.href;
    navigator.clipboard.writeText(shareUrl);
    alert("🔗 Share link copied to clipboard!");
  }

  return (
    <>
      <aside className={`aside-slide ${collapsed ? "hidden" : "visible"}`}>
        {/* --- Profile header --- */}
        <div className="sidebar-header">
          <div className="profile">
            <img
              src={`https://api.dicebear.com/7.x/identicon/svg?seed=${
                user?.username || user?.email || "guest"
              }`}
              alt="Profile avatar"
              className="profile-avatar"
            />
            <div className="profile-info">
              <div className="profile-name">
                {user?.username || user?.email || "Guest"}
              </div>
              <button className="logout-btn" onClick={logout}>
                Log out
              </button>
            </div>
          </div>
        </div>

        <ColorSelector selected={selected} toggle={toggle} />
        <MetaSelector metas={metas} selected={selected} toggle={toggle} />
        <LandCycleSelector
          groupedLandcycles={groupedLandcycles}
          selected={selected}
          toggle={toggle}
        />

        {/* --- Share Icon Button --- */}
        <div style={{ marginTop: "1.5rem", textAlign: "center" }}>
          <button
            className="export-btn"
            onClick={copyShareLink}
            title="Copy share link"
            aria-label="Share"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
              <polyline points="16 6 12 2 8 6" />
              <line x1="12" y1="2" x2="12" y2="15" />
            </svg>
          </button>
        </div>
      </aside>

      <button
        className={`sidebar-toggle ${collapsed ? "collapsed" : "open"}`}
        onClick={() => setCollapsed(!collapsed)}
        title={collapsed ? "Open menu" : "Hide menu"}
      >
        {collapsed ? "☰" : "×"}
      </button>
    </>
  );
}
