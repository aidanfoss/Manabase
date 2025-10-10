import { api } from "./client";

export const packageAPI = {
  // Get all packages for the logged-in user
  async list() {
    return api.json("/packages");
  },

  // Create new package
  async create(data) {
    return api.post("/packages", data);
  },

  // ✅ Update existing package
  async update(packageId, data) {
    return api.json(`/packages/${packageId}`, {
      method: "PUT",
      body: JSON.stringify(data),
    });
  },

  // Add a card to a package (not required for now but fine to keep)
  async addCard(packageId, card) {
    return api.post(`/packages/${packageId}/cards`, { card });
  },

  // Delete a package
  async delete(packageId) {
    return api.json(`/packages/${packageId}`, { method: "DELETE" });
  },
};
