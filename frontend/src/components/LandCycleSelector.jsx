import React from "react";

export default function LandCycleSelector({ groupedLandcycles, selected, toggle }) {
    const tiers = [
        ["premium", "🟩 Premium (Untapped)"],
        ["playable", "🟨 Playable (Conditional)"],
        ["budget", "🟥 Budget / Slow"],
        ["terrible", "⬛ Terrible (Actively Bad)"],
    ];

    return (
        <div className="section">
            <h3>Land Cycles</h3>
            {tiers.map(([tier, label]) => (
                <div key={tier} className={`tier-group ${tier}`}>
                    <div className="tier-label">{label}</div>
                    <div className="taglist">
                        {groupedLandcycles[tier].map((lc) => (
                            <button
                                key={lc.id ?? lc.name}
                                onClick={() => toggle("landcycles", lc.id ?? lc.name)}
                                className={[
                                    "tag",
                                    lc.fetchable ? "fetchable" : "",
                                    selected.landcycles.has(lc.id ?? lc.name) ? "active" : "",
                                ].join(" ")}
                                title={
                                    (lc.fetchable ? "Fetchable — " : "") + (lc.description || "")
                                }
                            >
                                {lc.name}
                            </button>
                        ))}
                    </div>
                </div>
            ))}
        </div>
    );
}
