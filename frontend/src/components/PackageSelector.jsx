import React from "react";

export default function MetaSelector({ metas, selected, toggle }) {
    return (
        <div className="section">
            <h3>Metas</h3>
            <div className="taglist">
                {metas.map((m) => (
                    <button
                        key={m.name}
                        onClick={() => toggle("metas", m.name)}
                        className={"tag" + (selected.metas.has(m.name) ? " active" : "")}
                    >
                        {m.name}
                    </button>
                ))}
            </div>
        </div>
    );
}
