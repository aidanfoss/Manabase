// frontend/src/services/presetsService.js
import { api } from "../api/client";

// Service to abstract preset data access for local/remote presets

export class PresetsService {
  // Get both local and community presets
  static async getPresets(params = {}) {
    try {
      return await api.json("/presets", { method: "GET", body: params });
    } catch (error) {
      console.error("Failed to fetch presets:", error);
      return [];
    }
  }

  // Get single preset by ID
  static async getPreset(id) {
    try {
      return await api.json(`/presets/${id}`);
    } catch (error) {
      console.error(`Failed to fetch preset ${id}:`, error);
      return null;
    }
  }

  // Create new user preset
  static async createPreset(presetData) {
    try {
      return await api.post("/presets", presetData);
    } catch (error) {
      console.error("Failed to create preset:", error);
      throw error;
    }
  }

  // Update existing user preset
  static async updatePreset(id, presetData) {
    try {
      return await api.json(`/presets/${id}`, {
        method: "PUT",
        body: JSON.stringify(presetData),
      });
    } catch (error) {
      console.error(`Failed to update preset ${id}:`, error);
      throw error;
    }
  }

  // Delete user preset
  static async deletePreset(id) {
    try {
      await api.deletePreset(id);
      return true;
    } catch (error) {
      console.error(`Failed to delete preset ${id}:`, error);
      throw error;
    }
  }

  // Import a community preset to user's collection
  static async importPreset(presetId) {
    try {
      const originalPreset = await this.getPreset(presetId);
      if (!originalPreset) throw new Error("Preset not found");

      // Create a copy for the user
      const importedPreset = {
        ...originalPreset,
        name: `${originalPreset.name} (Imported)`,
        shared: false,
        packages: originalPreset.packages || [], // Ensure packages are embedded
      };

      // Remove server-only fields
      delete importedPreset.id;
      delete importedPreset.createdAt;
      delete importedPreset.updatedAt;
      delete importedPreset.isDefaultPreset;

      return await this.createPreset(importedPreset);
    } catch (error) {
      console.error(`Failed to import preset ${presetId}:`, error);
      throw error;
    }
  }

  // Local storage fallback for when backend is unavailable
  static getLocalPresets() {
    try {
      const localPresets = localStorage.getItem("manabase-presets");
      return localPresets ? JSON.parse(localPresets) : [];
    } catch (error) {
      console.error("Failed to load local presets:", error);
      return [];
    }
  }

  static saveLocalPreset(preset) {
    try {
      const presets = this.getLocalPresets();
      const existingIndex = presets.findIndex(p => p.id === preset.id);

      if (existingIndex >= 0) {
        presets[existingIndex] = { ...preset, updatedAt: new Date().toISOString() };
      } else {
        presets.push({
          ...preset,
          id: preset.id || `local_${Date.now()}`,
          createdAt: preset.createdAt || new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
      }

      localStorage.setItem("manabase-presets", JSON.stringify(presets));
      return presets.find(p => p.id === (preset.id || presets[presets.length - 1].id));
    } catch (error) {
      console.error("Failed to save local preset:", error);
      throw error;
    }
  }

  static deleteLocalPreset(id) {
    try {
      const presets = this.getLocalPresets();
      const filtered = presets.filter(p => p.id !== id);
      localStorage.setItem("manabase-presets", JSON.stringify(filtered));
      return true;
    } catch (error) {
      console.error("Failed to delete local preset:", error);
      throw error;
    }
  }
}
