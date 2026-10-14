// frontend/src/pages/AdminDashboard.jsx
import React, { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { Navigate } from "react-router-dom";
import {
  ChartBarIcon,
  UsersIcon,
  ShieldCheckIcon,
  ExclamationTriangleIcon,
  TrashIcon,
  UserGroupIcon,
  XMarkIcon,
  FunnelIcon,
  ClockIcon,
  ArrowPathIcon
} from "@heroicons/react/24/solid";

export default function AdminDashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadingAnalytics, setLoadingAnalytics] = useState(true);
  const [error, setError] = useState(null);
  const [period, setPeriod] = useState(30);

  // Drilldown modal state
  const [drilldownFeature, setDrilldownFeature] = useState(null);
  const [drilldownUsers, setDrilldownUsers] = useState([]);
  const [loadingDrilldown, setLoadingDrilldown] = useState(false);
  const [drilldownError, setDrilldownError] = useState(null);

  const fetchAdminStats = async () => {
    try {
      const token = localStorage.getItem("token");
      const res = await fetch("/api/admin/stats", {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) {
        throw new Error("Failed to fetch admin stats. You might not have permission.");
      }
      const data = await res.json();
      setStats(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchAnalytics = async (days) => {
    setLoadingAnalytics(true);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`/api/analytics/stats?days=${days}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setAnalytics(data.stats);
      }
    } catch (err) {
      console.error("Failed to fetch analytics:", err);
    } finally {
      setLoadingAnalytics(false);
    }
  };

  useEffect(() => {
    fetchAdminStats();
  }, []);

  useEffect(() => {
    fetchAnalytics(period);
  }, [period]);

  const openDrilldown = async (feature) => {
    setDrilldownFeature(feature);
    setDrilldownUsers([]);
    setLoadingDrilldown(true);
    setDrilldownError(null);

    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`/api/analytics/feature-users/${feature.feature_key}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error("Failed to load user engagement data");
      const data = await res.json();
      setDrilldownUsers(data.users || []);
    } catch (err) {
      setDrilldownError(err.message);
    } finally {
      setLoadingDrilldown(false);
    }
  };

  const closeDrilldown = () => {
    setDrilldownFeature(null);
    setDrilldownUsers([]);
  };

  const isAdmin = user && (user.email === "quantumaidan@gmail.com" || user.email === "dev@manabase.com");

  if (!user || !isAdmin) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="collection-layout">
      <div className="collection-header">
        <h1 className="collection-title">
          <ShieldCheckIcon style={{ width: "1em", height: "1em", verticalAlign: "middle", marginRight: "8px" }} />
          Admin Dashboard
        </h1>
        <div className="collection-subtitle">
          System metrics, feature usage tracking, and prune candidates. Only visible to verified admins.
        </div>
      </div>

      <div className="collection-content">
        {loading ? (
          <div style={{ color: "#94a3b8", padding: "20px" }}>Loading admin metrics...</div>
        ) : error ? (
          <div style={{ color: "#ef4444", padding: "20px", background: "#450a0a", borderRadius: "8px" }}>
            <strong>Error:</strong> {error}
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "2rem" }}>

            {/* Top Metric Cards */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "1rem" }}>
              <StatCard title="Total Users" value={stats?.metrics?.totalUsers} icon={<UsersIcon />} />
              <StatCard title="Active Users (30d)" value={analytics?.active_users || 0} icon={<UserGroupIcon />} />
              <StatCard
                title="Prune Candidates"
                value={analytics?.prune_candidates_count || 0}
                icon={<TrashIcon />}
                highlightDanger={analytics?.prune_candidates_count > 0}
              />
              <StatCard title="Playgroups" value={stats?.metrics?.totalPlaygroups} />
              <StatCard title="Decks Synced" value={stats?.metrics?.totalDecksSynced} />
              <StatCard title="Cards Tracked" value={stats?.metrics?.totalCardsTracked} />
            </div>

            {/* Prune Candidates Callout Section */}
            <div style={{
              background: "#1e293b",
              borderRadius: "12px",
              padding: "1.5rem",
              border: "1px solid #7f1d1d",
              boxShadow: "0 4px 12px rgba(0,0,0,0.2)"
            }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "1rem", marginBottom: "1rem" }}>
                <h2 style={{ fontSize: "1.25rem", color: "#fca5a5", display: "flex", alignItems: "center", gap: "8px", margin: 0 }}>
                  <ExclamationTriangleIcon style={{ width: "1.2em", height: "1.2em", color: "#ef4444" }} />
                  Prune Candidates ({analytics?.prune_candidates?.length || 0})
                </h2>
                <div style={{ color: "#94a3b8", fontSize: "0.85rem" }}>
                  Criteria: &lt;5% user penetration or zero activity in past {period} days
                </div>
              </div>

              <p style={{ color: "#cbd5e1", fontSize: "0.95rem", marginBottom: "1.25rem" }}>
                These features show low user engagement. Review who uses them before deprecating or trimming to keep Manabase lean and maintainable.
              </p>

              {loadingAnalytics ? (
                <div style={{ color: "#94a3b8", padding: "1rem" }}>Analyzing feature usage...</div>
              ) : !analytics?.prune_candidates || analytics.prune_candidates.length === 0 ? (
                <div style={{ color: "#86efac", padding: "1rem", background: "#052e16", borderRadius: "8px" }}>
                  All registered features meet healthy usage thresholds.
                </div>
              ) : (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "1rem" }}>
                  {analytics.prune_candidates.map((feat) => (
                    <div
                      key={feat.feature_key}
                      style={{
                        background: "#0f172a",
                        border: "1px solid #334155",
                        borderRadius: "8px",
                        padding: "1rem",
                        display: "flex",
                        flexDirection: "column",
                        justifyContent: "space-between",
                        gap: "0.75rem"
                      }}
                    >
                      <div>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                          <span style={{ fontWeight: "600", color: "#f8fafc", fontSize: "1rem" }}>{feat.name}</span>
                          <span style={{ background: "#7f1d1d", color: "#fecaca", padding: "2px 8px", borderRadius: "4px", fontSize: "0.75rem", fontWeight: "600" }}>
                            {feat.penetration_pct}% Penetration
                          </span>
                        </div>
                        <div style={{ color: "#64748b", fontSize: "0.8rem", marginTop: "2px" }}>{feat.category}</div>
                      </div>

                      <div style={{ fontSize: "0.85rem", color: "#94a3b8", display: "flex", flexDirection: "column", gap: "4px" }}>
                        <div>Total Uses: <strong style={{ color: "#e2e8f0" }}>{feat.total_uses}</strong> ({feat.distinct_users} users, {feat.guest_uses} guests)</div>
                        <div>Last Active: <strong style={{ color: "#e2e8f0" }}>{feat.last_used_at ? new Date(feat.last_used_at).toLocaleDateString() : "Never"}</strong></div>
                      </div>

                      <button
                        onClick={() => openDrilldown(feat)}
                        style={{
                          background: "#334155",
                          color: "#f8fafc",
                          border: "none",
                          padding: "6px 12px",
                          borderRadius: "6px",
                          cursor: "pointer",
                          fontSize: "0.85rem",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: "6px",
                          transition: "background 0.2s"
                        }}
                        onMouseOver={(e) => (e.target.style.background = "#475569")}
                        onMouseOut={(e) => (e.target.style.background = "#334155")}
                      >
                        <UserGroupIcon style={{ width: "1em", height: "1em" }} />
                        View Engaged Users ({feat.distinct_users})
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Feature Usage & Penetration Matrix */}
            <div style={{ background: "#1e293b", borderRadius: "12px", padding: "1.5rem", border: "1px solid #334155" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "1rem", marginBottom: "1.25rem" }}>
                <h2 style={{ fontSize: "1.25rem", color: "#f8fafc", display: "flex", alignItems: "center", gap: "8px", margin: 0 }}>
                  <ChartBarIcon style={{ width: "1em", height: "1em" }} /> Feature Usage & Penetration Matrix
                </h2>

                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <span style={{ color: "#94a3b8", fontSize: "0.85rem", display: "flex", alignItems: "center", gap: "4px" }}>
                    <ClockIcon style={{ width: "1em", height: "1em" }} /> Window:
                  </span>
                  <button
                    onClick={() => setPeriod(30)}
                    style={{
                      background: period === 30 ? "#3b82f6" : "#0f172a",
                      color: "white",
                      border: "1px solid #334155",
                      padding: "4px 12px",
                      borderRadius: "6px",
                      cursor: "pointer",
                      fontSize: "0.85rem"
                    }}
                  >
                    30 Days
                  </button>
                  <button
                    onClick={() => setPeriod(90)}
                    style={{
                      background: period === 90 ? "#3b82f6" : "#0f172a",
                      color: "white",
                      border: "1px solid #334155",
                      padding: "4px 12px",
                      borderRadius: "6px",
                      cursor: "pointer",
                      fontSize: "0.85rem"
                    }}
                  >
                    90 Days
                  </button>
                  <button
                    onClick={() => fetchAnalytics(period)}
                    title="Refresh"
                    style={{
                      background: "#0f172a",
                      color: "#94a3b8",
                      border: "1px solid #334155",
                      padding: "4px 8px",
                      borderRadius: "6px",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center"
                    }}
                  >
                    <ArrowPathIcon style={{ width: "1em", height: "1em" }} />
                  </button>
                </div>
              </div>

              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid #334155", color: "#94a3b8", fontSize: "0.85rem" }}>
                      <th style={{ padding: "0.75rem 0.5rem" }}>Feature</th>
                      <th style={{ padding: "0.75rem 0.5rem" }}>Category</th>
                      <th style={{ padding: "0.75rem 0.5rem" }}>Total Uses</th>
                      <th style={{ padding: "0.75rem 0.5rem" }}>Users (Auth / Guest)</th>
                      <th style={{ padding: "0.75rem 0.5rem" }}>Penetration</th>
                      <th style={{ padding: "0.75rem 0.5rem" }}>Status</th>
                      <th style={{ padding: "0.75rem 0.5rem" }}>Last Active</th>
                      <th style={{ padding: "0.75rem 0.5rem", textAlign: "right" }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {analytics?.feature_stats?.map((feat) => {
                      const isPrune = feat.is_prune_candidate;
                      return (
                        <tr key={feat.feature_key} style={{ borderBottom: "1px solid #334155" }}>
                          <td style={{ padding: "0.75rem 0.5rem", color: "#f8fafc", fontWeight: "600" }}>
                            {feat.name}
                          </td>
                          <td style={{ padding: "0.75rem 0.5rem", color: "#94a3b8", fontSize: "0.85rem" }}>
                            {feat.category}
                          </td>
                          <td style={{ padding: "0.75rem 0.5rem", color: "#cbd5e1" }}>
                            {feat.total_uses.toLocaleString()}
                          </td>
                          <td style={{ padding: "0.75rem 0.5rem", color: "#cbd5e1" }}>
                            {feat.distinct_users} auth / {feat.guest_uses} guest
                          </td>
                          <td style={{ padding: "0.75rem 0.5rem", minWidth: "120px" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                              <div style={{ flex: 1, height: "6px", background: "#334155", borderRadius: "3px", overflow: "hidden" }}>
                                <div
                                  style={{
                                    height: "100%",
                                    width: `${Math.min(feat.penetration_pct, 100)}%`,
                                    background: isPrune ? "#ef4444" : feat.penetration_pct > 20 ? "#22c55e" : "#eab308"
                                  }}
                                />
                              </div>
                              <span style={{ fontSize: "0.8rem", color: "#cbd5e1", minWidth: "32px" }}>
                                {feat.penetration_pct}%
                              </span>
                            </div>
                          </td>
                          <td style={{ padding: "0.75rem 0.5rem" }}>
                            <span
                              style={{
                                background: isPrune ? "#7f1d1d" : "#065f46",
                                color: isPrune ? "#fecaca" : "#a7f3d0",
                                padding: "2px 8px",
                                borderRadius: "4px",
                                fontSize: "0.75rem",
                                fontWeight: "600"
                              }}
                            >
                              {isPrune ? "Prune Candidate" : "Healthy"}
                            </span>
                          </td>
                          <td style={{ padding: "0.75rem 0.5rem", color: "#94a3b8", fontSize: "0.85rem" }}>
                            {feat.last_used_at ? new Date(feat.last_used_at).toLocaleDateString() : "Never"}
                          </td>
                          <td style={{ padding: "0.75rem 0.5rem", textAlign: "right" }}>
                            <button
                              onClick={() => openDrilldown(feat)}
                              style={{
                                background: "transparent",
                                border: "1px solid #475569",
                                color: "#cbd5e1",
                                padding: "4px 8px",
                                borderRadius: "4px",
                                cursor: "pointer",
                                fontSize: "0.8rem"
                              }}
                            >
                              View Users
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Recent Signups Table */}
            <div style={{ background: "#1e293b", borderRadius: "12px", padding: "1.5rem", border: "1px solid #334155" }}>
              <h2 style={{ fontSize: "1.25rem", marginBottom: "1rem", color: "#f8fafc", display: "flex", alignItems: "center", gap: "8px" }}>
                <UsersIcon style={{ width: "1em", height: "1em" }} /> Recent Signups
              </h2>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid #334155", color: "#94a3b8" }}>
                      <th style={{ padding: "0.75rem 0" }}>Username</th>
                      <th style={{ padding: "0.75rem 0" }}>Email</th>
                      <th style={{ padding: "0.75rem 0" }}>Signup Date</th>
                      <th style={{ padding: "0.75rem 0" }}>Auth Method</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats?.recentSignups?.map((u) => {
                      const dateStr = new Date(u.created_at).toLocaleString();
                      const method = u.google_id ? "Google" : u.discord_id ? "Discord" : "Native";
                      return (
                        <tr key={u.id} style={{ borderBottom: "1px solid #334155" }}>
                          <td style={{ padding: "0.75rem 0", color: "#e2e8f0", fontWeight: "500" }}>{u.username}</td>
                          <td style={{ padding: "0.75rem 0", color: "#cbd5e1" }}>{u.email}</td>
                          <td style={{ padding: "0.75rem 0", color: "#94a3b8" }}>{dateStr}</td>
                          <td style={{ padding: "0.75rem 0" }}>
                            <span
                              style={{
                                background: method === "Google" ? "#1e3a8a" : method === "Discord" ? "#4c1d95" : "#166534",
                                color: "white",
                                padding: "2px 8px",
                                borderRadius: "4px",
                                fontSize: "0.8rem"
                              }}
                            >
                              {method}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                    {(!stats?.recentSignups || stats.recentSignups.length === 0) && (
                      <tr>
                        <td colSpan="4" style={{ padding: "1rem 0", color: "#94a3b8", textAlign: "center" }}>
                          No users found
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

          </div>
        )}
      </div>

      {/* User Drilldown Modal */}
      {drilldownFeature && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0, 0, 0, 0.75)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
            padding: "1rem"
          }}
          onClick={closeDrilldown}
        >
          <div
            style={{
              background: "#1e293b",
              borderRadius: "12px",
              border: "1px solid #334155",
              maxWidth: "650px",
              width: "100%",
              maxHeight: "80vh",
              display: "flex",
              flexDirection: "column",
              boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.5)"
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                padding: "1.25rem 1.5rem",
                borderBottom: "1px solid #334155",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center"
              }}
            >
              <div>
                <h3 style={{ margin: 0, color: "#f8fafc", fontSize: "1.2rem" }}>
                  {drilldownFeature.name} - Engaged Users
                </h3>
                <div style={{ color: "#94a3b8", fontSize: "0.85rem", marginTop: "2px" }}>
                  Historical usage breakdown from monthly ledger
                </div>
              </div>
              <button
                onClick={closeDrilldown}
                style={{
                  background: "transparent",
                  border: "none",
                  color: "#94a3b8",
                  cursor: "pointer",
                  padding: "4px"
                }}
              >
                <XMarkIcon style={{ width: "1.5em", height: "1.5em" }} />
              </button>
            </div>

            <div style={{ padding: "1.5rem", overflowY: "auto", flex: 1 }}>
              {loadingDrilldown ? (
                <div style={{ color: "#94a3b8", textAlign: "center", padding: "2rem" }}>
                  Loading engaged users...
                </div>
              ) : drilldownError ? (
                <div style={{ color: "#ef4444", padding: "1rem" }}>{drilldownError}</div>
              ) : drilldownUsers.length === 0 ? (
                <div style={{ color: "#94a3b8", textAlign: "center", padding: "2rem" }}>
                  No authenticated users have logged activity for this feature yet.
                </div>
              ) : (
                <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid #334155", color: "#94a3b8", fontSize: "0.85rem" }}>
                      <th style={{ padding: "0.5rem" }}>User</th>
                      <th style={{ padding: "0.5rem" }}>Total Uses</th>
                      <th style={{ padding: "0.5rem" }}>First Used</th>
                      <th style={{ padding: "0.5rem" }}>Last Used</th>
                    </tr>
                  </thead>
                  <tbody>
                    {drilldownUsers.map((u) => (
                      <tr key={u.id} style={{ borderBottom: "1px solid #334155" }}>
                        <td style={{ padding: "0.75rem 0.5rem" }}>
                          <div style={{ color: "#f8fafc", fontWeight: "600" }}>{u.username}</div>
                          <div style={{ color: "#64748b", fontSize: "0.8rem" }}>{u.email}</div>
                        </td>
                        <td style={{ padding: "0.75rem 0.5rem", color: "#e2e8f0", fontWeight: "600" }}>
                          {u.total_uses}
                        </td>
                        <td style={{ padding: "0.75rem 0.5rem", color: "#94a3b8", fontSize: "0.85rem" }}>
                          {u.first_used_at ? new Date(u.first_used_at).toLocaleDateString() : "N/A"}
                        </td>
                        <td style={{ padding: "0.75rem 0.5rem", color: "#94a3b8", fontSize: "0.85rem" }}>
                          {u.last_used_at ? new Date(u.last_used_at).toLocaleDateString() : "N/A"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            <div style={{ padding: "1rem 1.5rem", borderTop: "1px solid #334155", display: "flex", justifyContent: "flex-end" }}>
              <button
                onClick={closeDrilldown}
                style={{
                  background: "#334155",
                  color: "#f8fafc",
                  border: "none",
                  padding: "8px 16px",
                  borderRadius: "6px",
                  cursor: "pointer"
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ title, value, icon, highlightDanger }) {
  return (
    <div
      style={{
        background: "#1e293b",
        padding: "1.25rem",
        borderRadius: "12px",
        border: highlightDanger ? "1px solid #ef4444" : "1px solid #334155",
        display: "flex",
        flexDirection: "column",
        gap: "0.5rem"
      }}
    >
      <div
        style={{
          color: highlightDanger ? "#fca5a5" : "#94a3b8",
          fontSize: "0.85rem",
          fontWeight: "600",
          textTransform: "uppercase",
          letterSpacing: "0.05em",
          display: "flex",
          alignItems: "center",
          gap: "6px"
        }}
      >
        {icon && <span style={{ width: "1.2em", height: "1.2em" }}>{icon}</span>}
        {title}
      </div>
      <div style={{ color: highlightDanger ? "#ef4444" : "#f8fafc", fontSize: "2rem", fontWeight: "700" }}>
        {value?.toLocaleString() || "0"}
      </div>
    </div>
  );
}
