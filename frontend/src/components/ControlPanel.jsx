import React from "react";

export default function ControlPanel({
    metas,
    activeMetas,
    toggleMeta,
    landCycles,
    activeCycles,
    toggleCycle,
}) {
    return (
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center px-6 py-3 border-b border-gray-700">
            {/* LEFT SIDE: Land Cycles */}
            <div className="flex flex-wrap gap-4">
                {landCycles.map(cycle => (
                    <label key={cycle} className="flex items-center gap-2 cursor-pointer">
                        <input
                            type="checkbox"
                            checked={activeCycles.includes(cycle)}
                            onChange={() => toggleCycle(cycle)}
                            className="accent-green-500"
                        />
                        <span className="text-sm">{cycle}</span>
                    </label>
                ))}
            </div>

            {/* RIGHT SIDE: Meta Toggles */}
            <div className="flex flex-wrap gap-4 mt-3 sm:mt-0">
                {metas.map(meta => (
                    <label key={meta.name} className="flex items-center gap-2 cursor-pointer">
                        <span className="text-sm">{meta.label}</span>
                        <input
                            type="checkbox"
                            checked={activeMetas.includes(meta.name)}
                            onChange={() => toggleMeta(meta.name)}
                            className="accent-blue-400"
                        />
                    </label>
                ))}
            </div>
        </div>
    );
}
