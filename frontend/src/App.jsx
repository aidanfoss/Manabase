import React, { useState, useEffect } from "react";
import ColorSelector from "./components/ColorSelector";
import CardDisplay from "./components/CardDisplay";
import ControlPanel from "./components/ControlPanel";

export default function App() {
    const [selectedColors, setSelectedColors] = useState(["G"]);
    const [activeMetas, setActiveMetas] = useState(["fog_meta"]);
    const [activeCycles, setActiveCycles] = useState([]);
    const [metaData, setMetaData] = useState([]);
    const [landCycles, setLandCycles] = useState([]);

    // Load metas and land cycles from backend
    useEffect(() => {
        fetch("http://localhost:8080/api/metas")
            .then((r) => r.json())
            .then((names) =>
                setMetaData(
                    names.map((n) => ({
                        name: n,
                        label:
                            n === "fog_meta"
                                ? "Fog Meta"
                                : n === "voltron_meta"
                                    ? "Voltron Meta"
                                    : n,
                    }))
                )
            );

        fetch("http://localhost:8080/api/landcycles")
            .then((r) => r.json())
            .then(setLandCycles);
    }, []);

    const toggleColor = (color) =>
        setSelectedColors((prev) =>
            prev.includes(color) ? prev.filter((c) => c !== color) : [...prev, color]
        );

    const toggleMeta = (name) =>
        setActiveMetas((prev) =>
            prev.includes(name)
                ? prev.filter((m) => m !== name)
                : [...prev, name]
        );

    const toggleCycle = (name) =>
        setActiveCycles((prev) =>
            prev.includes(name)
                ? prev.filter((c) => c !== name)
                : [...prev, name]
        );

    return (
        <div className="min-h-screen bg-gray-950 text-gray-100">
            <h1 className="text-3xl text-center py-4 font-bold">
                Manabase & Meta Tool
            </h1>

            <ColorSelector selectedColors={selectedColors} toggleColor={toggleColor} />

            <ControlPanel
                metas={metaData}
                activeMetas={activeMetas}
                toggleMeta={toggleMeta}
                landCycles={landCycles}
                activeCycles={activeCycles}
                toggleCycle={toggleCycle}
            />

            {/* ==== LANDS SECTION ==== */}
            <CardDisplay
                selectedColors={selectedColors}
                activeCycles={activeCycles}
                activeMetas={activeMetas}
                sectionName="Lands"
            />

            {/* ==== STAPLES SECTION ==== */}
            <CardDisplay
                selectedColors={selectedColors}
                activeCycles={activeCycles}
                activeMetas={activeMetas}
                sectionName="Staples"
            />

            {/* ==== SIDEBOARD SECTION ==== */}
            <CardDisplay
                selectedColors={selectedColors}
                activeCycles={activeCycles}
                activeMetas={activeMetas}
                sectionName="Sideboard"
            />
        </div>
    );
}
