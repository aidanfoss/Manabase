/**
 * Utility functions for safely reading and parsing JSON files.
 * Handles UTF-8 BOM stripping and gracefully falls back to an empty object if parsing fails.
 */

import fs from "fs";

/**
 * Safely parse a JSON string, stripping any BOM and catching syntax errors.
 * @param {string} text
 * @returns {any|null}
 */
export function safeJsonParse(text) {
    if (typeof text !== "string") return null;
    try {
        const clean = text.replace(/^\uFEFF/, ""); // remove BOM if present
        return JSON.parse(clean);
    } catch (e) {
        console.error("⚠️ safeJsonParse: Failed to parse JSON:", e.message);
        return null;
    }
}

/**
 * Safely read and parse a JSON file from disk.
 * Returns `fallback` (default: `{}`) if file doesn't exist or parsing fails.
 * @param {string} filePath
 * @param {any} fallback
 * @returns {any}
 */
export function readJsonSafe(filePath, fallback = {}) {
    try {
        if (!fs.existsSync(filePath)) {
            console.warn(`⚠️ readJsonSafe: File not found: ${filePath}`);
            return fallback;
        }
        const raw = fs.readFileSync(filePath, "utf8");
        const parsed = safeJsonParse(raw);
        return parsed ?? fallback;
    } catch (e) {
        console.error("⚠️ readJsonSafe error:", e.message);
        return fallback;
    }
}

// Backward compatibility alias
export const parseJsonSafe = safeJsonParse;
