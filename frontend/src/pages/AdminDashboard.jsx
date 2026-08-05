// frontend/src/pages/AdminDashboard.jsx
import React, { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { Navigate } from "react-router-dom";
import { ChartBarIcon, UsersIcon, ShieldCheckIcon } from "@heroicons/react/24/solid";

export default function AdminDashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const token = localStorage.getItem("token");
        const res = await fetch("/api/admin/stats", {
          headers: {
            Authorization: `Bearer ${token}`
          }
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
    fetchStats();
  }, []);

  const isAdmin = user && (user.email === "quantumaidan@gmail.com" || user.email === "dev@manabase.com");
  
  if (!user || !isAdmin) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="collection-layout">
      <div className="collection-header">
        <h1 className="collection-title">
          <ShieldCheckIcon style={{ width: '1em', height: '1em', verticalAlign: 'middle', marginRight: '8px' }} />
          Admin Dashboard
        </h1>
        <div className="collection-subtitle">System metrics and user management. Only visible to verified admins.</div>
      </div>

      <div className="collection-content">
        {loading ? (
          <div style={{ color: '#94a3b8', padding: '20px' }}>Loading admin metrics...</div>
        ) : error ? (
          <div style={{ color: '#ef4444', padding: '20px', background: '#450a0a', borderRadius: '8px' }}>
            <strong>Error:</strong> {error}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
            
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
              <StatCard title="Total Users" value={stats?.metrics?.totalUsers} icon={<UsersIcon />} />
              <StatCard title="Total Playgroups" value={stats?.metrics?.totalPlaygroups} />
              <StatCard title="Total Decks Synced" value={stats?.metrics?.totalDecksSynced} />
              <StatCard title="Cards Tracked" value={stats?.metrics?.totalCardsTracked} />
              <StatCard title="Total Proxy Orders" value={stats?.metrics?.totalProxyOrders} />
              <StatCard title="Total Trades" value={stats?.metrics?.totalTrades} />
            </div>

            <div style={{ background: '#1e293b', borderRadius: '12px', padding: '1.5rem', border: '1px solid #334155' }}>
              <h2 style={{ fontSize: '1.25rem', marginBottom: '1rem', color: '#f8fafc', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <ChartBarIcon style={{ width: '1em', height: '1em' }} /> Recent Signups
              </h2>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid #334155', color: '#94a3b8' }}>
                      <th style={{ padding: '0.75rem 0' }}>Username</th>
                      <th style={{ padding: '0.75rem 0' }}>Email</th>
                      <th style={{ padding: '0.75rem 0' }}>Signup Date</th>
                      <th style={{ padding: '0.75rem 0' }}>Auth Method</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats?.recentSignups?.map((u) => {
                      const dateStr = new Date(u.created_at).toLocaleString();
                      const method = u.google_id ? "Google" : u.discord_id ? "Discord" : "Native";
                      return (
                        <tr key={u.id} style={{ borderBottom: '1px solid #334155' }}>
                          <td style={{ padding: '0.75rem 0', color: '#e2e8f0', fontWeight: '500' }}>{u.username}</td>
                          <td style={{ padding: '0.75rem 0', color: '#cbd5e1' }}>{u.email}</td>
                          <td style={{ padding: '0.75rem 0', color: '#94a3b8' }}>{dateStr}</td>
                          <td style={{ padding: '0.75rem 0' }}>
                            <span style={{ 
                              background: method === 'Google' ? '#1e3a8a' : method === 'Discord' ? '#4c1d95' : '#166534',
                              color: 'white', padding: '2px 8px', borderRadius: '4px', fontSize: '0.8rem'
                            }}>
                              {method}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                    {(!stats?.recentSignups || stats.recentSignups.length === 0) && (
                      <tr>
                        <td colSpan="4" style={{ padding: '1rem 0', color: '#94a3b8', textAlign: 'center' }}>No users found</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ title, value, icon }) {
  return (
    <div style={{ background: '#1e293b', padding: '1.5rem', borderRadius: '12px', border: '1px solid #334155', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
      <div style={{ color: '#94a3b8', fontSize: '0.9rem', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: '6px' }}>
        {icon && <span style={{ width: '1.2em', height: '1.2em' }}>{icon}</span>}
        {title}
      </div>
      <div style={{ color: '#f8fafc', fontSize: '2rem', fontWeight: '700' }}>
        {value?.toLocaleString() || "0"}
      </div>
    </div>
  );
}
