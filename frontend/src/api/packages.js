import { api } from "./client";

export const packageAPI = {
  async list() {
    return api.json("/packages");
  },
  async create(data) {
    return api.post("/packages", data);
  },
  async addCard(packageId, card) {
    return api.post(`/packages/${packageId}/cards`, { card });
  },
  async delete(packageId) {
    return api.json(`/packages/${packageId}`, { method: "DELETE" });
  },
};
