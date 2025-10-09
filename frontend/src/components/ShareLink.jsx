import React from "react";

export default function ShareLink() {
    return (
        <div className="section">
            <h3>Share</h3>
            <button
                className="tag active"
                onClick={() => {
                    navigator.clipboard.writeText(window.location.href);
                    alert("🔗 Link copied to clipboard!");
                }}
            >
                Copy Share Link
            </button>
        </div>
    );
}
