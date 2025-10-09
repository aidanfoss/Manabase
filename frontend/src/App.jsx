import React, { useEffect, useMemo, useState } from "react";
import { api } from "./api/client";
import { encodeSelection, decodeSelection } from "./utils/hashState";
import Sidebar from "./components/Sidebar";
import MainContent from "./components/MainContent";
import BottomBar from "./components/BottomBar";
import "./styles.css";

export default function App() {
    const [metas, setMetas] = useState([]);
    const [landcycles, setLandcycles] = useState([]);
    const [data, setData] = useState({ lands: [], nonlands: [] });
    const [status, setStatus] = useState("idle");
    const [error, setError] = useState(null);
    const [collapsed, setCollapsed] = useState(true);

    const [selected, setSelected] = useState({
        metas: new Set(),
        landcycles: new Set(),
        colors: new Set(),
    });

    // Restore hash from URL
    useEffect(() => {
        if (window.location.hash.length > 1) {
            const decoded = decodeSelection(window.location.hash.substring(1));
            if (decoded && decoded.version >= 1) {
                setSelected({
                    metas: new Set(decoded.metas || []),
                    landcycles: new Set(decoded.landcycles || []),
                    colors: new Set(decoded.colors || []),
                });
            }
        }
    }, []);

    // Load metas + landcycles
    useEffect(() => {
        (async () => {
            try {
                const [m, l] = await Promise.all([api.getMetas(), api.getLandcycles()]);
                setMetas(m || []);
                setLandcycles(l || []);
            } catch (e) {
                console.error("Failed to load metas/landcycles:", e);
            }
        })();
    }, []);

    function toggle(setName, value) {
        setSelected((prev) => {
            const ns = new Set(prev[setName]);
            ns.has(value) ? ns.delete(value) : ns.add(value);
            return { ...prev, [setName]: ns };
        });
    }

    const query = useMemo(() => {
        const colorsArr = [...selected.colors];
        const effectiveColors = colorsArr.length === 0 ? ["colorless"] : colorsArr;
        return {
            metas: [...selected.metas],
            landcycles: [...selected.landcycles],
            colors: effectiveColors,
        };
    }, [selected]);

    // Fetch cards from backend
    useEffect(() => {
        setStatus("loading");
        setError(null);

        api
            .getCards(query)
            .then((payload) => {
                if (payload?.fetchableSummary?.length && landcycles.length) {
                    setLandcycles((prev) =>
                        prev.map((lc) => {
                            const found = payload.fetchableSummary.find(
                                (f) => f.id === lc.id || f.id === lc.name
                            );
                            return found ? { ...lc, fetchable: found.fetchable } : lc;
                        })
                    );
                }

                let parsed = { lands: [], nonlands: [] };
                if (Array.isArray(payload)) parsed.lands = payload;
                else if (payload && typeof payload === "object")
                    parsed = {
                        lands: payload.lands || [],
                        nonlands: payload.nonlands || [],
                    };

                setData(parsed);
                setStatus("done");

                const selection = {
                    version: 1,
                    metas: [...selected.metas],
                    landcycles: [...selected.landcycles],
                    colors: [...selected.colors],
                };
                const hash = encodeSelection(selection);
                window.history.replaceState(null, "", `#${hash}`);
            })
            .catch((e) => {
                setError(e.message || String(e));
                setStatus("error");
            });
    }, [query.metas.join("|"), query.landcycles.join("|"), query.colors.join("|")]);

    return (
        <div className={`app ${collapsed ? "sidebar-collapsed" : "sidebar-open"}`}>
            <Sidebar
                metas={metas}
                landcycles={landcycles}
                selected={selected}
                toggle={toggle}
                collapsed={collapsed}
                setCollapsed={setCollapsed}
            />
            <MainContent
                data={data}
                status={status}
                error={error}
            />
            <BottomBar data={data} />
        </div>
    );
}
