import React from "react";

export default function ColorSelector({ selected, toggle }) {
    return (
        <div className="section">
            <h3>Colors</h3>
            <div className="color-buttons">
                {["W", "U", "B", "R", "G"].map((c) => (
                    <button
                        key={c}
                        onClick={() => toggle("colors", c)}
                        className={
                            "color-btn color-" + c + (selected.colors.has(c) ? " active" : "")
                        }
                    >
                        {c}
                    </button>
                ))}
            </div>
        </div>
    );
}
