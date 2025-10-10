import React, { useMemo } from "react";
import ColorSelector from "./ColorSelector";
import PackageSelector from "./PackageSelector";
import LandCycleSelector from "./LandCycleSelector";
import { useAuth } from "../context/AuthContext";

export default function Sidebar({
  packages = [],     // ✅ renamed from metas, with safe default
  landcycles = [],
  selected,
  toggle,
  collapsed,          // keep for className
}) {
  const { user } = useAuth();

  const groupedLandcycles = useMemo(() => {
    const groups = { premium: [], playable: [], budget: [], terrible: [] };
    for (const lc of landcycles) {
      const tier = lc.tier?.toLowerCase() || "budget";
      (groups[tier] ?? groups.budget).push(lc);
    }
    for (const tier in groups) {
      groups[tier].sort((a, b) => a.name.localeCompare(b.name));
    }
    return groups;
  }, [landcycles]);

  function copyShareLink() {
    navigator.clipboard.writeText(window.location.href);
    alert("🔗 Share link copied to clipboard!");
  }

  return (
    <aside className={`aside-slide ${collapsed ? "hidden" : "visible"}`}>
      {/* Profile */}
      <div className="sidebar-header">
        <div className="profile">
          <div className="profile-info">
            <div className="profile-name">
              {user?.username || user?.email || "Guest"}
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <ColorSelector selected={selected} toggle={toggle} />
      <PackageSelector packages={packages} selected={selected} toggle={toggle} />
      <LandCycleSelector
        groupedLandcycles={groupedLandcycles}
        selected={selected}
        toggle={toggle}
      />

      {/* Share button */}
      <div style={{ marginTop: "1.25rem", textAlign: "center" }}>
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
  );
}
