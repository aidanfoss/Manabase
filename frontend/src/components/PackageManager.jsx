import React, { useState, useEffect } from "react";
import { api } from "../api/client";
import { useAuth } from "../context/AuthContext";
import PackageEditor from "./PackageEditor";
import "../styles/packageManager.css";

export default function PackageManager({ onApplyPackage }) {
  const { user } = useAuth();
  const [packages, setPackages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("your"); // "your" or "community"
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingPackage, setEditingPackage] = useState(null);

  useEffect(() => {
    loadPackages();
  }, []);

  const loadPackages = async () => {
    try {
      const data = await api.getPackages();
      setPackages(data);
    } catch (error) {
      console.error("Failed to load packages:", error);
    } finally {
      setLoading(false);
    }
  };

  const yourPackages = packages.filter(p => p.userId || p.isUserPackage);
  const communityPackages = packages.filter(p => p.isDefaultPackage || !p.userId);

  const filteredPackages = activeTab === "your" ? yourPackages : communityPackages;

  const handleEditPackage = (pkg) => {
    setEditingPackage(pkg);
  };

  const handleDeletePackage = async (pkg) => {
    if (!window.confirm(`Are you sure you want to delete the "${pkg.name}" package?`)) {
      return;
    }

    try {
      await api.deletePackage(pkg.id);
      setPackages(prev => prev.filter(p => p.id !== pkg.id));
    } catch (error) {
      console.error("Failed to delete package:", error);
      alert("Failed to delete package. Please try again.");
    }
  };

  return (
    <div className="packages-screen">
      <div className="packages-header">
        <h1>Packages</h1>
        <button
          className="btn-primary"
          onClick={() => setShowCreateModal(true)}
          disabled={!user}
        >
          Create New Package
        </button>
      </div>

      <div className="packages-tabs">
        <button
          className={activeTab === "your" ? "active" : ""}
          onClick={() => setActiveTab("your")}
        >
          Your Packages
        </button>
        <button
          className={activeTab === "community" ? "active" : ""}
          onClick={() => setActiveTab("community")}
        >
          Community Packages
        </button>
      </div>

      <div className="packages-content">
        {loading ? (
          <div className="loading">Loading packages...</div>
        ) : (
          <div className="packages-grid">
            {filteredPackages.map((pkg) => (
              <PackageCard
                key={pkg.id}
                package={pkg}
                onEdit={() => handleEditPackage(pkg)}
                onDelete={user ? () => handleDeletePackage(pkg) : null}
              />
            ))}
            {filteredPackages.length === 0 && (
              <div className="empty-state">
                {activeTab === "your" ? "You haven't created any packages yet." : "No community packages available."}
              </div>
            )}
          </div>
        )}
      </div>

      {showCreateModal && (
        <CreatePackageModal
          onClose={() => setShowCreateModal(false)}
          onSave={(pkg) => {
            setPackages(prev => [...prev, pkg]);
            setShowCreateModal(false);
          }}
        />
      )}

      {editingPackage && (
        <PackageEditor
          package={editingPackage}
          onClose={() => setEditingPackage(null)}
          onApply={onApplyPackage}
          onSave={(updatedPackage) => {
            setPackages(prev => prev.map(p => p.id === updatedPackage.id ? updatedPackage : p));
            setEditingPackage(null);
          }}
        />
      )}
    </div>
  );
}

function PackageCard({ package: pkg, onEdit, onDelete }) {
  return (
    <div className="package-list-item">
      <div className="package-list-content">
        <span className="package-name">{pkg.name}</span>
        <span className="package-cards-count">{pkg.cards?.length || 0} cards</span>
        <span className="package-author">{pkg.userId ? "User" : "Community"}</span>
      </div>
      <div className="package-list-actions">
        <button
          className="btn-primary-small"
          onClick={onEdit}
        >
          Select
        </button>
        {!pkg.isDefaultPackage && onDelete && (
          <button className="btn-delete-small" onClick={onDelete}>
            ×
          </button>
        )}
      </div>
    </div>
  );
}

function CreatePackageModal({ onClose, onSave }) {
  const [form, setForm] = useState({
    name: "",
    description: "",
    cards: []
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const pkg = await api.savePackage(form);
      onSave(pkg);
    } catch (error) {
      console.error("Failed to create package:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <h2>Create New Package</h2>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Name</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm(prev => ({ ...prev, name: e.target.value }))}
              required
            />
          </div>
          <div className="form-group">
            <label>Description (optional)</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm(prev => ({ ...prev, description: e.target.value }))}
              rows={3}
              placeholder="Describe what this package contains..."
            />
          </div>
          <div className="modal-actions">
            <button type="button" onClick={onClose}>Cancel</button>
            <button type="submit" disabled={loading} className="btn-primary">
              {loading ? "Creating..." : "Create"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
