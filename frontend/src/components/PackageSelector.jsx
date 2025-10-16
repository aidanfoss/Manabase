import React, { useState, useEffect } from "react";
import { api } from "../api/client";

export default function PackageSelector({ selectedPackages = [], onChange, disabled = false, compact = false }) {
  const [packages, setPackages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [open, setOpen] = useState(true);

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

  const filteredPackages = packages.filter(pkg =>
    pkg.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (pkg.description && pkg.description.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const handleTogglePackage = (pkgId) => {
    if (disabled) return;

    const newSelected = selectedPackages.includes(pkgId)
      ? selectedPackages.filter(id => id !== pkgId)
      : [...selectedPackages, pkgId];

    onChange(newSelected);
  };

  const selectedPackageNames = packages
    .filter(pkg => selectedPackages.includes(pkg.id))
    .map(pkg => pkg.name);

  if (compact) {
    // Compact card-based view for sidebar
    return (
      <div className="package-selector-compact">
        <h3
          className="dropdown-header"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            cursor: "pointer",
            userSelect: "none",
            marginBottom: "0.5rem"
          }}
          onClick={() => setOpen((o) => !o)}
        >
          <span>Packages</span>
          <span
            style={{
              fontSize: "0.8em",
              transform: open ? "rotate(0deg)" : "rotate(-90deg)",
              transition: "transform 0.2s ease",
            }}
          >
            ▼
          </span>
        </h3>

        {open && (
          <div className="packages-compact-list">
            {loading ? (
              <div className="loading">Loading packages...</div>
            ) : packages.length === 0 ? (
              <div className="empty-state">No packages available</div>
            ) : (
              packages.map(pkg => (
                <div
                  key={pkg.id}
                  className={`package-compact-card ${selectedPackages.includes(pkg.id) ? 'selected' : ''} ${disabled ? 'disabled' : ''}`}
                  onClick={() => handleTogglePackage(pkg.id)}
                >
                  <div className="package-compact-header">
                    <h5>{pkg.name}</h5>
                    <span className="package-compact-count">{pkg.cards?.length || 0}</span>
                  </div>
                  {pkg.description && (
                    <p className="package-compact-description">
                      {pkg.description.length > 40
                        ? `${pkg.description.substring(0, 40)}...`
                        : pkg.description
                      }
                    </p>
                  )}
                </div>
              ))
            )}
          </div>
        )}
      </div>
    );
  }

  // Full interactive view for package manager/presets
  return (
    <div className="package-selector">
      <label>Selected Packages ({selectedPackages.length})</label>
      {selectedPackageNames.length > 0 && (
        <div className="selected-packages-list">
          {selectedPackageNames.join(", ")}
        </div>
      )}

      <input
        type="text"
        placeholder="Search packages..."
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        className="package-search-input"
        disabled={disabled}
      />

      <div className="packages-list">
        {loading ? (
          <div className="loading">Loading packages...</div>
        ) : filteredPackages.length === 0 ? (
          <div className="empty-state">No packages found</div>
        ) : (
          filteredPackages.map(pkg => (
            <div
              key={pkg.id}
              className={`package-option ${selectedPackages.includes(pkg.id) ? 'selected' : ''} ${disabled ? 'disabled' : ''}`}
              onClick={() => handleTogglePackage(pkg.id)}
            >
              <div className="package-option-header">
                <h4>{pkg.name}</h4>
                <span className="package-count">{pkg.cards?.length || 0} cards</span>
              </div>
              {pkg.description && (
                <p className="package-description">{pkg.description}</p>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
