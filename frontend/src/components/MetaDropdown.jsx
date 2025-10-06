import React, { useEffect, useState } from "react";

export default function MetaDropdown({ meta, setMeta }) {
    const [metas, setMetas] = useState([]);

    useEffect(() => {
        fetch("http://localhost:8080/api/metas")
            .then(r => r.json())
            .then(setMetas)
            .catch(console.error);
    }, []);

    return (
        <div className="flex justify-center my-3">
            <select
                className="px-3 py-2 border rounded-md text-black"
                value={meta}
                onChange={e => setMeta(e.target.value)}
            >
                {metas.map(m => (
                    <option key={m}>{m}</option>
                ))}
            </select>
        </div>
    );
}
