import React, { useState, useEffect } from "react";
import { CheckCircleIcon, XMarkIcon, ArrowUpTrayIcon } from "@heroicons/react/24/solid";
import { parseImportInput } from "../utils/csvImporter";
import "../styles/onboarding.css";

const SLIDES = [
  { img: "/onboarding/step1.png", text: "1. Tap on Collection in the bottom menu." },
  { img: "/onboarding/step2.png", text: "2. Tap the 3 dots in the top right." },
  { img: "/onboarding/step3.png", text: "3. Tap Export." },
  { img: "/onboarding/step4.png", text: "4. Tap Export to save your CSV file." }
];

export default function OnboardingModal({ user, onClose }) {
  const [step, setStep] = useState("ask"); // "ask", "tutorial", "importing"
  const [currentSlide, setCurrentSlide] = useState(0);
  const [importText, setImportText] = useState("");
  const [fileName, setFileName] = useState("");
  const [importing, setImporting] = useState(false);
  const [importStatus, setImportStatus] = useState("");

  // Cycle through animation slides
  useEffect(() => {
    let interval;
    if (step === "tutorial") {
      interval = setInterval(() => {
        setCurrentSlide((prev) => (prev + 1) % SLIDES.length);
      }, 3500);
    }
    return () => clearInterval(interval);
  }, [step]);

  const handleSkip = () => {
    localStorage.setItem(`onboarding_seen_${user.id || user.username}`, "true");
    onClose();
  };

  const handleYes = () => {
    setStep("tutorial");
  };

  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result || "";
      setImportText(text);
      try {
        const parsedCards = parseImportInput(text);
        setImportStatus(`Loaded "${file.name}" (${(file.size / 1024).toFixed(1)} KB) — ${parsedCards.length} cards detected.`);
      } catch (err) {
        setImportStatus(`Loaded "${file.name}" (${(file.size / 1024).toFixed(1)} KB).`);
      }
    };
    reader.readAsText(file);
  };

  const handleImport = async () => {
    if (!importText.trim()) return;

    const token = localStorage.getItem("token");
    if (!token) {
      alert("Please log in to import cards.");
      return;
    }

    setImporting(true);
    setImportStatus("Parsing ManaBox export...");

    try {
      const parsedCards = parseImportInput(importText);
      if (parsedCards.length === 0) {
        alert("No valid cards found in the provided CSV text.");
        setImporting(false);
        setImportStatus("");
        return;
      }

      setImportStatus(`Found ${parsedCards.length} cards. Starting batch import...`);

      // Route according to proxy status
      const processedCards = parsedCards.map(c => ({
        ...c,
        list_type: c.is_proxy ? "proxy" : "owned",
        is_proxy: !!c.is_proxy
      }));

      const CHUNK_SIZE = 500;
      let totalAdded = 0;

      for (let i = 0; i < processedCards.length; i += CHUNK_SIZE) {
        const chunk = processedCards.slice(i, i + CHUNK_SIZE);
        const batchNum = Math.floor(i / CHUNK_SIZE) + 1;
        const totalBatches = Math.ceil(processedCards.length / CHUNK_SIZE);

        setImportStatus(`Importing batch ${batchNum} of ${totalBatches}...`);

        const res = await fetch("/api/collection/owned/bulk", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ cards: chunk }),
        });

        if (res.ok) {
          const data = await res.json();
          totalAdded += data.count || chunk.length;
        }
      }

      alert(`Successfully imported ${totalAdded} cards into your collection! Welcome to Manabase.`);
      handleSkip(); // Finish onboarding
    } catch (err) {
      console.error("Failed importing onboarding cards:", err);
      alert("An error occurred during import. Please try again or skip for now.");
    } finally {
      setImporting(false);
      setImportStatus("");
    }
  };

  return (
    <div className="onboarding-modal-overlay">
      <div className="onboarding-modal-content">
        <button
          onClick={handleSkip}
          style={{ position: "absolute", top: "1rem", right: "1rem", background: "none", border: "none", color: "#cbd5e1", cursor: "pointer" }}
          title="Skip"
        >
          <XMarkIcon style={{ width: "1.5rem", height: "1.5rem" }} />
        </button>

        {step === "ask" && (
          <>
            <h1 className="onboarding-title">Welcome to Manabase</h1>
            <p style={{ fontSize: "1.2rem", color: "#cbd5e1" }}>Do you currently use ManaBox?</p>
            <div className="onboarding-buttons">
              <button className="onboarding-btn primary" onClick={handleYes}>
                Yes, I do!
              </button>
              <button className="onboarding-btn secondary" onClick={handleSkip}>
                No, skip this
              </button>
            </div>
          </>
        )}

        {step === "tutorial" && (
          <>
            <h2 className="onboarding-title" style={{ fontSize: "2rem" }}>Import your Collection</h2>

            <div className="onboarding-animation-container">
              {SLIDES.map((slide, idx) => (
                <div key={idx} className={`onboarding-slide ${idx === currentSlide ? "active" : ""}`}>
                  <img src={slide.img} alt={`Step ${idx + 1}`} className="onboarding-image" />
                  <div className="onboarding-caption">{slide.text}</div>
                </div>
              ))}
              <div className="onboarding-slide-dots">
                {SLIDES.map((_, idx) => (
                  <button
                    key={idx}
                    type="button"
                    className={`onboarding-dot ${idx === currentSlide ? "active" : ""}`}
                    onClick={() => setCurrentSlide(idx)}
                    aria-label={`Go to step ${idx + 1}`}
                  />
                ))}
              </div>
            </div>

            <div className="onboarding-import-zone">
              <div className="onboarding-file-upload-row">
                <label htmlFor="onboarding-file-input" className="onboarding-file-btn">
                  <ArrowUpTrayIcon style={{ width: "1.25rem", height: "1.25rem", marginRight: "0.5rem" }} />
                  {fileName ? `Selected: ${fileName}` : "Upload ManaBox CSV File"}
                </label>
                <input
                  id="onboarding-file-input"
                  type="file"
                  accept=".csv,.txt"
                  onChange={handleFileUpload}
                  style={{ display: "none" }}
                  disabled={importing}
                />
              </div>

              <div className="onboarding-divider">
                <span>or paste CSV text</span>
              </div>

              <textarea
                id="onboarding-csv-text"
                aria-label="Paste exported CSV text"
                className="onboarding-textarea"
                placeholder="Name,Set code,Collector number,Foil,Quantity,Condition,Language..."
                value={importText}
                onChange={(e) => {
                  setImportText(e.target.value);
                  if (fileName) setFileName("");
                }}
                disabled={importing}
              ></textarea>

              {importStatus && <div className="onboarding-status">{importStatus}</div>}

              <button
                className="onboarding-import-btn"
                onClick={handleImport}
                disabled={importing || !importText.trim()}
              >
                {importing ? "Importing..." : "Complete Import"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
