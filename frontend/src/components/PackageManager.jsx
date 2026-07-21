import React, { useState, useEffect } from "react";
import { api } from "../api/client";
import { useAuth } from "../context/AuthContext";
import PackageEditor from "./PackageEditor";
import { MoxfieldService } from "../services/moxfieldService";
import "../styles/packageManager.css";

export default function PackageManager({ onApplyPackage }) {
  const { user } = useAuth();
  const [packages, setPackages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("your"); // "your" or "community"
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
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

  const handleUpdatePackage = async (updatedPackage) => {
    try {
      const savedPackage = await api.savePackage(updatedPackage);
      setPackages(prev => prev.map(p => p.id === savedPackage.id ? savedPackage : p));
      return savedPackage;
    } catch (error) {
      console.error("Failed to update package:", error);
      throw error; // Re-throw to let PackageCard handle the error
    }
  };

  const handleImportFromMoxfield = async (url) => {
    try {
      // Import from Moxfield via our backend (which handles CORS)
      const importedData = await api.importFromMoxfield(url);

      // Create the package
      const newPackage = await api.savePackage({
        name: importedData.name,
        cards: importedData.cards,
        description: `Imported from Moxfield deck: ${importedData.sourceUrl}`
      });

      // Add to packages list and close modal
      setPackages(prev => [...prev, newPackage]);
      setShowImportModal(false);

      // Show success message
      alert(`Successfully imported "${newPackage.name}" with ${newPackage.cards.length} cards!`);

    } catch (error) {
      console.error("Failed to import from Moxfield:", error);
      alert(`Import failed: ${error.message}`);
    }
  };

  return (
    <div className="packages-screen">
      <div className="packages-header">
        <h1>Packages</h1>
        <div className="packages-header-buttons">
          <button
            className="btn-secondary"
            onClick={() => setShowImportModal(true)}
          >
            Import from Moxfield
          </button>
          <button
            className="btn-primary"
            onClick={() => setShowCreateModal(true)}
            disabled={!user}
          >
            Create New Package
          </button>
        </div>
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
                onUpdatePackage={handleUpdatePackage}
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

      {showImportModal && (
        <ImportModal
          onClose={() => setShowImportModal(false)}
          onImport={handleImportFromMoxfield}
        />
      )}

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

function PackageCard({ package: pkg, onEdit, onDelete, onUpdatePackage }) {
  const [isRenaming, setIsRenaming] = useState(false);
  const [newName, setNewName] = useState(pkg.name);

  const handleRenameClick = () => {
    setIsRenaming(true);
    setNewName(pkg.name);
  };

  const handleRenameSubmit = async (e) => {
    e.preventDefault();
    if (!newName.trim() || newName.trim() === pkg.name) {
      setIsRenaming(false);
      return;
    }

    try {
      const updatedPackage = { ...pkg, name: newName.trim() };
      await onUpdatePackage(updatedPackage);
      setIsRenaming(false);
    } catch (error) {
      console.error("Failed to rename package:", error);
      alert("Failed to rename package. Please try again.");
      setNewName(pkg.name);
      setIsRenaming(false);
    }
  };

  const handleRenameCancel = () => {
    setNewName(pkg.name);
    setIsRenaming(false);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') {
      handleRenameCancel();
    } else if (e.key === 'Enter') {
      handleRenameSubmit(e);
    }
  };

  return (
    <div className="package-list-item">
      <div className="package-list-content">
        {isRenaming ? (
          <form onSubmit={handleRenameSubmit} className="package-rename-form">
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onBlur={handleRenameSubmit}
              onKeyDown={handleKeyDown}
              className="package-rename-input"
              autoFocus
              maxLength={50}
            />
          </form>
        ) : (
          <span
            className="package-name"
            onClick={handleRenameClick}
            title="Click to rename"
            style={{ cursor: 'pointer' }}
          >
            {pkg.name}
          </span>
        )}
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

function ImportModal({ onClose, onImport }) {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!url.trim()) return;

    setLoading(true);
    try {
      await onImport(url.trim());
    } catch (error) {
      // Error is handled in the parent component
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') {
      onClose();
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <h2>Import from Moxfield</h2>
        <p>Enter a Moxfield deck URL to import it as a package.</p>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Moxfield Deck URL</label>
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="https://moxfield.com/decks/..."
              className="moxfield-url-input"
              autoFocus
              required
            />
          </div>

          <div className="modal-actions">
            <button type="button" onClick={onClose} disabled={loading}>
              Cancel
            </button>
            <button type="submit" disabled={loading || !url.trim()} className="btn-primary">
              {loading ? "Importing..." : "Import"}
            </button>
          </div>
        </form>

        <div className="import-help">
          <p>Example: https://moxfield.com/decks/IKbNfhe_sU65t9KBUTq4tQ</p>
        </div>
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
