import React from "react";
import Card from "./Card";

export default function MainContent({ data, status, error }) {
    function exportSection(name, cards) {
        if (!cards?.length) return;
        const lines = cards.map((c) => {
            const setCode = (c.set || c.prints?.[0]?.set || "").toUpperCase();
            const collector = c.collector_number || c.prints?.[0]?.collector_number || "";
            if (setCode && collector) return `1 ${c.name} (${setCode}) ${collector}`;
            if (setCode) return `1 ${c.name} (${setCode})`;
            return `1 ${c.name}`;
        });
        const blob = new Blob([lines.join("\n")], { type: "text/plain" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `${name}.txt`;
        link.click();
        URL.revokeObjectURL(url);
    }

    function copySection(name, cards) {
        if (!cards?.length) return;
        const text = cards
            .map((c) => {
                const setCode = (c.set || c.prints?.[0]?.set || "").toUpperCase();
                const collector = c.collector_number || c.prints?.[0]?.collector_number || "";
                if (setCode && collector) return `1 ${c.name} (${setCode}) ${collector}`;
                if (setCode) return `1 ${c.name} (${setCode})`;
                return `1 ${c.name}`;
            })
            .join("\n");
        navigator.clipboard.writeText(text);
        alert(`📋 Copied ${name} list to clipboard!`);
    }

    if (status === "loading") return <div className="status">Loading cards…</div>;
    if (status === "error") return <div className="status error">Error: {error}</div>;

    return (
        <main className="main">
            {["lands", "nonlands"].map((section) => {
                const cards = data[section] || [];
                if (!cards.length) return null;
                const title = section === "lands" ? "Lands" : "Non-Lands";
                return (
                    <div key={section}>
                        <div className="section-title-row">
                            <div className="section-title">{title}</div>
                            {cards.length > 0 && (
                                <div className="export-controls">
                                    <button
                                        className="export-btn"
                                        onClick={() => exportSection(title, cards)}
                                    >
                                        Export
                                    </button>
                                    <button
                                        className="copy-btn small"
                                        onClick={() => copySection(title, cards)}
                                    >
                                        Copy
                                    </button>
                                </div>
                            )}
                        </div>
                        <div className="grid">
                            {cards.map((it, i) => (
                                <Card key={i} item={it} />
                            ))}
                        </div>
                    </div>
                );
            })}
        </main>
    );
}
