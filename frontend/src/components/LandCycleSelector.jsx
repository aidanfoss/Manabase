import React, { useState } from "react";

export default function LandCycleSelector({ groupedLandcycles, selected, toggle, moveDown }) {
    const [open, setOpen] = useState(true); // dropdown open by default

    const tiers = [
        ["premium", "🟩 Premium (Untapped)"],
        ["playable", "🟨 Playable (Conditional)"],
        ["budget", "🟥 Budget / Slow"],
        ["terrible", "⬛ Terrible (Actively Bad)"],
    ];

    return (
        <div className="section land-cycle-section">
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
                <span>Land Cycles</span>
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
                <>
                    {tiers.map(([tier, label]) => (
                        <div key={tier} className={`tier-group ${tier}`}>
                            <div className="tier-label">{label}</div>
                            <div className="taglist">
                                {groupedLandcycles[tier].map((lc) => (
                                    <button
                                        key={lc.id ?? lc.name}
                                        onClick={() =>
                                            toggle("landcycles", lc.id ?? lc.name)
                                        }
                                        className={[
                                            "tag",
                                            lc.fetchable ? "fetchable" : "",
                                            selected.landcycles.has(lc.id ?? lc.name)
                                                ? "active"
                                                : "",
                                        ].join(" ")}
                                        title={
                                            (lc.fetchable ? "Fetchable — " : "") +
                                            (lc.description || "")
                                        }
                                    >
                                        {lc.name}
                                    </button>
                                ))}
                            </div>
                        </div>
                    ))}
                </>
            )}
        </div>
    );
}
