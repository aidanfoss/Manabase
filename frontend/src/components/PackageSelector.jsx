// frontend/src/components/PackageSelector.jsx
import React from "react";

export default function PackageSelector({ packages = [], selected, toggle }) {
  if (!Array.isArray(packages) || packages.length === 0) {
    return (
      <section className="section">
        <h3>Packages</h3>
        <p className="helper">No packages loaded yet.</p>
      </section>
    );
  }

  return (
    <section className="section">
      <h3>Packages</h3>
      <div className="taglist">
        {packages.map((pkg) => (
          <button
            key={pkg.id}
            onClick={() => toggle("packages", String(pkg.id))} // ✅ send ID
            className={
              "tag" + (selected.packages?.has(String(pkg.id)) ? " active" : "")
            }
          >
            {pkg.name}
          </button>
        ))}
      </div>
    </section>
  );
}
