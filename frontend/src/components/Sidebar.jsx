import React, { useMemo } from "react";
import ColorSelector from "./ColorSelector";
import MetaSelector from "./PackageSelector";
import LandCycleSelector from "./LandCycleSelector";
import ShareLink from "./ShareLink";

export default function Sidebar({
    metas,
    landcycles,
    selected,
    toggle,
    collapsed,
    setCollapsed,
}) {
    const groupedLandcycles = useMemo(() => {
        const groups = { premium: [], playable: [], budget: [], terrible: [] };
        for (const lc of landcycles) {
            const tier = lc.tier?.toLowerCase() || "budget";
            if (groups[tier]) groups[tier].push(lc);
            else groups.budget.push(lc);
        }
        for (const tier in groups) {
            groups[tier].sort((a, b) => a.name.localeCompare(b.name));
        }
        return groups;
    }, [landcycles]);

    return (
        <>
            <aside className={`aside-slide ${collapsed ? "hidden" : "visible"}`}>
                <h2>Manabase Builder</h2>
                <p className="helper">
                    Select colors, metas, and land cycles to populate cards.
                </p>

                <ColorSelector selected={selected} toggle={toggle} />
                <MetaSelector metas={metas} selected={selected} toggle={toggle} />
                <LandCycleSelector groupedLandcycles={groupedLandcycles} selected={selected} toggle={toggle} />
                <ShareLink />
            </aside>

            <button
                className={`sidebar-toggle ${collapsed ? "collapsed" : "open"}`}
                onClick={() => setCollapsed(!collapsed)}
                title={collapsed ? "Open menu" : "Hide menu"}
            >
                {collapsed ? "☰" : "×"}
            </button>
        </>
    );
}
