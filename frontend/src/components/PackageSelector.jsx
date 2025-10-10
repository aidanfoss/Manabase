import React, { useState } from "react";
import { useAuth } from "../context/AuthContext";

export default function PackageSelector({ packages = [], selected, toggle }) {
  const { user } = useAuth();
  const [open, setOpen] = useState(true);

  if (!Array.isArray(packages) || packages.length === 0) {
    return (
      <section className="section">
        <h3
          className="dropdown-header"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            cursor: "pointer",
            userSelect: "none",
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
        {open && <p className="helper">No packages loaded yet.</p>}
      </section>
    );
  }

  return (
    <section className="section">
      <h3
        className="dropdown-header"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          cursor: "pointer",
          userSelect: "none",
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
        <div className="taglist">
          {packages.map((pkg) => {
            const isOwner = user && pkg.user_id === user.id;
            const isPublic = pkg.is_public && (!user || pkg.user_id !== user.id);

            const colorClass = isOwner
              ? "tag-own"
              : isPublic
              ? "tag-public"
              : "tag-neutral";

            return (
              <button
                key={pkg.id}
                onClick={() => toggle("packages", String(pkg.id))}
                className={[
                  "tag",
                  colorClass,
                  selected.packages?.has(String(pkg.id)) ? "active" : "",
                ].join(" ")}
                title={
                  isOwner
                    ? "Your Package"
                    : isPublic
                    ? "Public Package"
                    : "Private Package"
                }
              >
                {pkg.name}
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
}
