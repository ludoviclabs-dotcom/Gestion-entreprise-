import { describe, it, expect, vi, beforeEach } from "vitest";

const state = vi.hoisted(() => ({
  afterCallbacks: [] as (() => Promise<void> | void)[],
  completed: [] as string[],
  failCompletion: false,
}));

vi.mock("next/server", () => ({
  after: (fn: () => Promise<void> | void) => {
    state.afterCallbacks.push(fn);
  },
}));
vi.mock("@/lib/data/cases-repository", () => ({
  getCasesRepository: () => ({
    async createCaseFromSiren() {
      return { id: "11111111-2222-4333-8444-555555555555" };
    },
    async completePendingPress(id: string) {
      if (state.failCompletion) throw new Error("boom");
      state.completed.push(id);
    },
  }),
}));
vi.mock("@/lib/data/graph-query-repository", () => ({
  getGraphQueryRepository: () => ({}),
}));

import { createCaseAction } from "@/app/(app)/cases/actions";

describe("createCaseAction — presse collectée après la réponse", () => {
  beforeEach(() => {
    state.afterCallbacks.length = 0;
    state.completed.length = 0;
    state.failCompletion = false;
  });

  it("renvoie le dossier sans attendre la presse, qui est planifiée après la réponse", async () => {
    const result = await createCaseAction("552032534");
    expect(result).toEqual({ ok: true, id: "11111111-2222-4333-8444-555555555555" });
    // Planifiée, pas encore exécutée : la réponse n'a pas attendu GDELT.
    expect(state.afterCallbacks).toHaveLength(1);
    expect(state.completed).toEqual([]);

    await state.afterCallbacks[0]();
    expect(state.completed).toEqual(["11111111-2222-4333-8444-555555555555"]);
  });

  it("une erreur de la collecte différée n'est jamais propagée", async () => {
    state.failCompletion = true;
    await createCaseAction("552032534");
    await expect(state.afterCallbacks[0]()).resolves.toBeUndefined();
  });

  it("un SIREN invalide ne planifie rien", async () => {
    const result = await createCaseAction("123");
    expect(result.ok).toBe(false);
    expect(state.afterCallbacks).toHaveLength(0);
  });
});
