import React, { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";

export default function Playgroups() {
  const { user } = useAuth();
  const [playgroups, setPlaygroups] = useState([]);
  const [newGroupName, setNewGroupName] = useState("");
  const [joinGroupId, setJoinGroupId] = useState("");
  const [activeGroup, setActiveGroup] = useState(null);
  const [inventory, setInventory] = useState([]);
  const [uploadStatus, setUploadStatus] = useState("");

  useEffect(() => {
    fetchPlaygroups();
    fetchInventory();
  }, []);

  const fetchPlaygroups = async () => {
    try {
      const res = await fetch("/api/playgroups", {
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` }
      });
      if (res.ok) {
        const data = await res.json();
        setPlaygroups(data);
        if (data.length > 0 && !activeGroup) {
          setActiveGroup(data[0]);
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchInventory = async () => {
    try {
      const res = await fetch("/api/inventory", {
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` }
      });
      if (res.ok) setInventory(await res.json());
    } catch (err) {
      console.error(err);
    }
  };

  const createGroup = async () => {
    if (!newGroupName) return;
    try {
      const res = await fetch("/api/playgroups", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("token")}` 
        },
        body: JSON.stringify({ name: newGroupName })
      });
      if (res.ok) {
        setNewGroupName("");
        fetchPlaygroups();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const joinGroup = async () => {
    if (!joinGroupId) return;
    try {
      const res = await fetch(`/api/playgroups/${joinGroupId}/join`, {
        method: "POST",
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` }
      });
      if (res.ok) {
        setJoinGroupId("");
        fetchPlaygroups();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setUploadStatus("Uploading...");
    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("/api/inventory/upload", {
        method: "POST",
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
        body: formData
      });
      
      const data = await res.json();
      if (res.ok) {
        setUploadStatus(`Success! Imported ${data.count} cards.`);
        fetchInventory();
      } else {
        setUploadStatus(`Error: ${data.error}`);
      }
    } catch (err) {
      setUploadStatus("Upload failed.");
      console.error(err);
    }
  };

  return (
    <div style={{ padding: "2rem", color: "white" }}>
      <h1>Playgroup Nexus</h1>
      
      <div style={{ display: "flex", gap: "2rem", marginTop: "2rem" }}>
        {/* LEFT COLUMN - PLAYGROUPS */}
        <div style={{ flex: 1, background: "#222", padding: "1rem", borderRadius: "8px" }}>
          <h2>Your Playgroups</h2>
          {playgroups.map(pg => (
            <div 
              key={pg.id} 
              style={{ padding: "0.5rem", background: activeGroup?.id === pg.id ? "#444" : "#333", margin: "0.5rem 0", cursor: "pointer" }}
              onClick={() => setActiveGroup(pg)}
            >
              {pg.name} (ID: {pg.id})
            </div>
          ))}

          <div style={{ marginTop: "2rem" }}>
            <h3>Create Group</h3>
            <input 
              value={newGroupName} 
              onChange={e => setNewGroupName(e.target.value)} 
              placeholder="Group Name" 
              style={{ marginRight: "0.5rem" }}
            />
            <button onClick={createGroup}>Create</button>
          </div>

          <div style={{ marginTop: "1rem" }}>
            <h3>Join Group</h3>
            <input 
              value={joinGroupId} 
              onChange={e => setJoinGroupId(e.target.value)} 
              placeholder="Group ID" 
              style={{ marginRight: "0.5rem" }}
            />
            <button onClick={joinGroup}>Join</button>
          </div>
        </div>

        {/* RIGHT COLUMN - INVENTORY & MPC */}
        <div style={{ flex: 2, background: "#222", padding: "1rem", borderRadius: "8px" }}>
          <h2>Inventory Management</h2>
          
          <div style={{ background: "#333", padding: "1rem", marginBottom: "1rem" }}>
            <h3>ManaBox CSV Upload</h3>
            <p style={{ fontSize: "0.9rem", color: "#aaa" }}>
              Please use the standard ManaBox export headers (Name, Set code, Collector number, Foil, Market Price).
            </p>
            <input type="file" accept=".csv" onChange={handleFileUpload} />
            {uploadStatus && <p style={{ marginTop: "0.5rem", color: uploadStatus.includes("Error") ? "red" : "green" }}>{uploadStatus}</p>}
          </div>

          <h3>Your Cards ({inventory.length})</h3>
          <div style={{ maxHeight: "300px", overflowY: "auto", background: "#111", padding: "1rem" }}>
            {inventory.slice(0, 100).map(card => (
              <div key={card.id} style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid #333", padding: "0.2rem 0" }}>
                <span>{card.card_name} {card.is_foil ? "✨" : ""}</span>
                <span>${card.market_price}</span>
              </div>
            ))}
            {inventory.length > 100 && <div style={{ textAlign: "center", color: "#666", marginTop: "0.5rem" }}>...and {inventory.length - 100} more</div>}
          </div>
        </div>
      </div>
    </div>
  );
}
