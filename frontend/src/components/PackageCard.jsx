import React from "react";

export default function PackageCard({ pkg }) {
  return (
    <div className="package-card">
      <h3>{pkg.name}</h3>
      <p>{pkg.cards?.length || 0} cards</p>
    </div>
  );
}
