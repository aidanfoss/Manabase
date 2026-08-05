import React, { useState, useEffect } from "react";
import { ArrowUpTrayIcon, TrashIcon, ArrowPathIcon } from "@heroicons/react/24/outline";
import { useToast } from "../context/ToastContext";

export default function ProxyArtSettings({ userProxyArts, fetchProxyArts, missingArtsCount, onDownloadMissingArts }) {
  const { showToast } = useToast();
  const [isUploading, setIsUploading] = useState(false);
  const [showTutorial, setShowTutorial] = useState(false);
  const [dontShowAgain, setDontShowAgain] = useState(false);

  useEffect(() => {
    const isDismissed = localStorage.getItem("manabase_proxy_arts_tutorial_dismissed");
    if (!isDismissed) {
      setShowTutorial(true);
    }
  }, []);

  const dismissTutorial = () => {
    if (dontShowAgain) {
      localStorage.setItem("manabase_proxy_arts_tutorial_dismissed", "true");
    }
    setShowTutorial(false);
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setIsUploading(true);
    const reader = new FileReader();
    reader.onload = async (event) => {
      const xmlString = event.target.result;
      try {
        const token = localStorage.getItem("token");
        const res = await fetch("/api/user/proxy-arts/import", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({ xml: xmlString })
        });
        
        const data = await res.json();
        if (data.success) {
          showToast(`Successfully imported ${data.count} art selections!`, "success");
          fetchProxyArts(); // Refresh the list
        } else {
          showToast(data.error || "Failed to import proxy arts.", "error");
        }
      } catch (err) {
        console.error("Import error:", err);
        showToast("Error importing proxy arts XML.", "error");
      } finally {
        setIsUploading(false);
      }
    };
    reader.readAsText(file);
    e.target.value = null; // reset
  };

  const handleDelete = async (id) => {
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`/api/user/proxy-arts/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        showToast("Removed art selection.", "success");
        fetchProxyArts();
      }
    } catch (err) {
      console.error("Delete error:", err);
      showToast("Failed to delete art selection.", "error");
    }
  };

  return (
    <div className="proxy-art-settings" style={{ padding: '1rem', position: 'relative' }}>
      
      {showTutorial && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.7)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '12px', padding: '2rem', maxWidth: '600px', width: '90%', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5), 0 10px 10px -5px rgba(0, 0, 0, 0.2)' }}>
            <h2 style={{ margin: '0 0 1rem 0', color: '#f8fafc', fontSize: '1.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              Proxy Art Workflow
            </h2>
            <p style={{ color: '#94a3b8', lineHeight: '1.6', marginBottom: '1.5rem' }}>
              Ensure you always get the exact art you want when generating your playgroup's MPC XML! Here is how the workflow works:
            </p>
            
            <ol style={{ color: '#cbd5e1', lineHeight: '1.6', paddingLeft: '1.5rem', marginBottom: '2rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <li><strong>Add Cards:</strong> Add cards to your Proxy Wishlist.</li>
              <li><strong>Check Missing:</strong> If a card is missing an art selection, a red badge will appear on this tab.</li>
              <li><strong>Download Missing:</strong> Click the "Download X Missing" button to generate an XML of just those cards.</li>
              <li><strong>Choose Arts:</strong> Upload that XML to <a href="https://mpcfill.com" target="_blank" rel="noopener noreferrer" style={{ color: '#3b82f6', textDecoration: 'underline' }}>MPCFill.com</a> and pick your preferred arts.</li>
              <li><strong>Export & Save:</strong> Export the finalized XML from MPCFill and click the <strong>Upload XML</strong> button here to save your selections permanently!</li>
            </ol>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #334155', paddingTop: '1.5rem' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#94a3b8', cursor: 'pointer', fontSize: '0.9rem' }}>
                <input 
                  type="checkbox" 
                  checked={dontShowAgain}
                  onChange={(e) => setDontShowAgain(e.target.checked)}
                  style={{ width: '1rem', height: '1rem', accentColor: '#3b82f6' }}
                />
                Don't show this again
              </label>
              
              <button 
                onClick={dismissTutorial}
                className="action-btn primary" 
                style={{ background: '#3b82f6', color: 'white', padding: '10px 20px', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', border: 'none' }}
              >
                Got it!
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="settings-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <div>
          <h2 style={{ margin: 0, color: 'white', fontSize: '1.5rem' }}>Saved MPCFill Art Selections</h2>
          <p style={{ margin: '4px 0 0 0', color: '#94a3b8', fontSize: '0.95rem' }}>
            Upload an MPCFill XML to save your per-card art preferences.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          {missingArtsCount > 0 && (
            <button
              onClick={onDownloadMissingArts}
              className="action-btn"
              style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'transparent', border: '1px solid #ef4444', color: '#fca5a5', padding: '8px 16px', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}
            >
              <ArrowUpTrayIcon style={{ width: '1.2em', transform: 'rotate(180deg)' }} />
              Download {missingArtsCount} Missing
            </button>
          )}
          
          <input
            type="file"
            accept=".xml"
            id="mpcfill-upload"
            style={{ display: "none" }}
            onChange={handleFileUpload}
            disabled={isUploading}
          />
          <label htmlFor="mpcfill-upload" className="action-btn primary" style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem', background: '#3b82f6', color: 'white', padding: '8px 16px', borderRadius: '6px', fontWeight: 'bold' }}>
            {isUploading ? <ArrowPathIcon className="spin" style={{ width: '1.2em' }} /> : <ArrowUpTrayIcon style={{ width: '1.2em' }} />}
            Upload XML
          </label>
        </div>
      </div>

      <div className="table-container" style={{ background: '#1e293b', borderRadius: '8px', border: '1px solid #334155', overflow: 'hidden' }}>
        {userProxyArts.length === 0 ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: '#94a3b8' }}>
            No saved arts yet. Upload an MPCFill XML to get started!
          </div>
        ) : (
          <div style={{ maxHeight: '600px', overflowY: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', color: 'white' }}>
              <thead style={{ position: 'sticky', top: 0, background: '#0f172a', zIndex: 1 }}>
                <tr>
                  <th style={{ padding: '16px', borderBottom: '1px solid #334155' }}>Card Name</th>
                  <th style={{ padding: '16px', borderBottom: '1px solid #334155' }}>MPCFill Name</th>
                  <th style={{ padding: '16px', borderBottom: '1px solid #334155', width: '80px', textAlign: 'center' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {userProxyArts.map(art => (
                  <tr key={art.id} style={{ borderBottom: '1px solid #334155', background: '#1e293b' }}>
                    <td style={{ padding: '16px', fontWeight: '500' }}>{art.card_name}</td>
                    <td style={{ padding: '16px', color: '#cbd5e1' }}>{art.mpcfill_name}</td>
                    <td style={{ padding: '16px', textAlign: 'center' }}>
                      <button 
                        onClick={() => handleDelete(art.id)}
                        style={{ background: '#ef444420', border: '1px solid #ef4444', color: '#ef4444', cursor: 'pointer', padding: '6px', borderRadius: '4px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                        title="Remove saved art"
                      >
                        <TrashIcon style={{ width: '1.2em' }} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
