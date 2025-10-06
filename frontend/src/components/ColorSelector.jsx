import React from "react";

const COLORS = [
    { id: "W", name: "White", color: "#f0e0a0" },
    { id: "U", name: "Blue", color: "#8dc4ff" },
    { id: "B", name: "Black", color: "#505050" },
    { id: "R", name: "Red", color: "#ff7b7b" },
    { id: "G", name: "Green", color: "#7bff95" },
];

export default function ColorSelector({ selectedColors, toggleColor }) {
    return (
        <div className="flex gap-3 justify-center py-3">
            {COLORS.map(c => (
                <button
                    key={c.id}
                    onClick={() => toggleColor(c.id)}
                    style={{
                        backgroundColor: selectedColors.includes(c.id) ? c.color : "#333",
                        color: selectedColors.includes(c.id) ? "black" : "white",
                    }}
                    className="rounded-full px-4 py-2 font-bold transition-all hover:scale-105"
                >
                    {c.id}
                </button>
            ))}
        </div>
    );
}
