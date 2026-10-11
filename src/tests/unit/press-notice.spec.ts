// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, createElement as h } from "react";
import { createRoot, type Root } from "react-dom/client";
import { isPressStale, PRESS_STALE_MS } from "@/lib/data/press-status";

const refresh = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));

import PressNotice from "@/components/cases/PressNotice.client";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | null = null;
let host: HTMLElement | null = null;

function mount(props: Parameters<typeof PressNotice>[0]) {
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  act(() => root!.render(h(PressNotice, props)));
}

const advance = (ms: number) =>
  act(() => {
    vi.advanceTimersByTime(ms);
  });

describe("PressNotice — rafraîchissement jusqu'à l'échéance serveur", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-11T10:00:00.000Z"));
    refresh.mockClear();
  });
  afterEach(() => {
    act(() => root?.unmount());
    host?.remove();
    root = null;
    host = null;
    vi.useRealTimers();
  });

  it("rafraîchit toutes les 5 s pendant la première minute", () => {
    mount({ state: "pending", requestedAt: new Date().toISOString() });
    advance(60_000);
    expect(refresh).toHaveBeenCalledTimes(12);
  });

  it("continue plus lentement : le bandeau bascule à l'échéance sans rechargement manuel", () => {
    mount({ state: "pending", requestedAt: new Date().toISOString() });
    advance(60_000);
    const afterFast = refresh.mock.calls.length;

    // Jusqu'à l'échéance (10 min) : encore des rafraîchissements, plus espacés.
    advance(PRESS_STALE_MS - 60_000);
    const atDeadline = refresh.mock.calls.length;
    expect(atDeadline).toBeGreaterThan(afterFast + 10);
    expect(atDeadline - afterFast).toBeLessThanOrEqual(25);

    // Un rafraîchissement a eu lieu APRÈS l'échéance : le serveur peut alors
    // rendre le bandeau « interrompue ».
    advance(2_000);
    expect(refresh.mock.calls.length).toBeGreaterThan(atDeadline);
  });

  it("s'arrête définitivement après l'échéance (plus de sondage indéfini)", () => {
    mount({ state: "pending", requestedAt: new Date().toISOString() });
    advance(PRESS_STALE_MS + 120_000);
    const total = refresh.mock.calls.length;
    advance(30 * 60_000);
    expect(refresh).toHaveBeenCalledTimes(total);
  });

  it("une collecte déjà interrompue n'effectue aucun sondage", () => {
    mount({ state: "interrupted" });
    advance(5 * 60_000);
    expect(refresh).not.toHaveBeenCalled();
    expect(host!.textContent).toContain("Presse non consultée");
  });

  it("à défaut d'horodatage, la durée de sondage reste bornée", () => {
    mount({ state: "pending" });
    advance(PRESS_STALE_MS + 120_000);
    const total = refresh.mock.calls.length;
    advance(30 * 60_000);
    expect(refresh).toHaveBeenCalledTimes(total);
  });
});

describe("isPressStale — sans horodatage exploitable", () => {
  it("ne présente jamais « en cours » une collecte dont on ne peut prouver l'activité", () => {
    expect(isPressStale({ state: "pending" })).toBe(true);
    expect(isPressStale({ state: "pending", requestedAt: "pas une date" })).toBe(true);
    expect(isPressStale({ state: "done" })).toBe(false);
  });
});
