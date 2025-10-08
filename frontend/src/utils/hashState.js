// src/utils/hashState.js
// Handles compressing and encoding selected state into a hash for sharing.

function base64urlEncode(str) {
    return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64urlDecode(str) {
    str = str.replace(/-/g, "+").replace(/_/g, "/");
    while (str.length % 4) str += "=";
    return atob(str);
}

/**
 * Create a hash string from a selection object.
 * Example: { version:1, metas:["Fog Meta"], landcycles:["Shocklands"], colors:["W","U"] }
 */
export function encodeSelection(selection) {
    try {
        const json = JSON.stringify(selection);
        return base64urlEncode(json);
    } catch (e) {
        console.error("Failed to encode selection:", e);
        return "";
    }
}

/**
 * Decode a hash string back into a selection object.
 */
export function decodeSelection(hash) {
    try {
        const json = base64urlDecode(hash);
        const data = JSON.parse(json);
        return data;
    } catch {
        return null;
    }
}
