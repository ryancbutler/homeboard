// @vitest-environment jsdom

import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { DashboardData } from "@/lib/dashboard";
import { Homeboard } from "@/components/homeboard";

const dashboard = (completed = false): DashboardData => ({
  household: { name: "Test family", subheading: "Our day", timezone: "America/Chicago", showBanner: false },
  children: [{ id: "child", name: "Alex", color: "#123456", avatarUrl: null, away: null }],
  chores: [],
  routines: [
    {
      id: "run",
      title: "Morning routine",
      icon: null,
      owner: "Alex",
      ownerId: "child",
      ownerColor: "#123456",
      eligibleChildIds: ["child"],
      completedSteps: Number(completed),
      totalSteps: 2,
      steps: [
        { id: "brush", title: "Brush teeth", icon: null, completed },
        { id: "dress", title: "Get dressed", icon: null, completed: false },
      ],
      templateId: "template",
      dayPart: "morning",
      displayOrder: 0,
    },
  ],
  generatedAt: new Date().toISOString(),
});

function deferredResponse() {
  let resolve!: (response: Response) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<Response>((resolveResponse, rejectResponse) => {
    resolve = resolveResponse;
    reject = rejectResponse;
  });
  return { promise, resolve, reject };
}

describe("routine checkmarks", () => {
  let root: Root;
  let container: HTMLDivElement;
  let fetchMock: ReturnType<typeof vi.fn<typeof fetch>>;

  beforeEach(() => {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    fetchMock = vi.fn<typeof fetch>();
    vi.stubGlobal("fetch", fetchMock);
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
  });

  const render = async (data = dashboard()) => {
    await act(async () => root.render(createElement(Homeboard, { initialData: data })));
  };

  const button = (label: string) => {
    const element = container.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`);
    if (!element) throw new Error(`Missing button: ${label}`);
    return element;
  };

  const click = async (element: HTMLButtonElement) => {
    await act(async () => element.click());
  };

  it("checks the step and updates progress before a slow save finishes", async () => {
    const save = deferredResponse();
    fetchMock.mockImplementation(async (path) =>
      path === "/api/v1/dashboard" ? Response.json(dashboard(true)) : save.promise
    );
    await render();

    await click(button("Complete Brush teeth"));

    const checked = button("Uncheck Brush teeth");
    expect(checked.classList.contains("checked")).toBe(true);
    expect(checked.querySelector("svg")).not.toBeNull();
    expect(checked.getAttribute("aria-pressed")).toBe("true");
    expect(checked.getAttribute("aria-busy")).toBe("true");
    expect(checked.disabled).toBe(true);
    expect(button("Complete Get dressed").disabled).toBe(false);
    expect(container.querySelector('progress[aria-label="Alex: 1 of 2 routine steps done"]')).not.toBeNull();
    expect(container.querySelector(".connection")?.textContent).toContain("Saving");
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/v1/routine-runs/run/steps/brush",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ actorId: "child", completed: true }),
      })
    );
    await click(checked);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await act(async () => save.resolve(Response.json({ ok: true })));

    expect(button("Uncheck Brush teeth").disabled).toBe(false);
    expect(button("Uncheck Brush teeth").getAttribute("aria-busy")).toBe("false");
    expect(container.querySelector(".connection")?.textContent).toContain("All synced");
  });

  it.each([false, true])("restores the previous state when saving fails (initially checked: %s)", async (completed) => {
    const save = deferredResponse();
    fetchMock.mockImplementation(async (path) =>
      path === "/api/v1/dashboard" ? Response.json(dashboard(completed)) : save.promise
    );
    await render(dashboard(completed));

    await click(button(`${completed ? "Uncheck" : "Complete"} Brush teeth`));

    const optimistic = button(`${completed ? "Complete" : "Uncheck"} Brush teeth`);
    expect(optimistic.getAttribute("aria-pressed")).toBe(String(!completed));
    expect(optimistic.querySelector("svg") !== null).toBe(!completed);

    await act(async () => save.resolve(Response.json({ error: "Unable to save. Try again." }, { status: 500 })));

    const restored = button(`${completed ? "Uncheck" : "Complete"} Brush teeth`);
    expect(restored.getAttribute("aria-pressed")).toBe(String(completed));
    expect(restored.disabled).toBe(false);
    expect(container.textContent).toContain("Couldn't update routine");
    expect(container.textContent).toContain("Unable to save. Try again.");
    expect(
      container.querySelector(`progress[aria-label="Alex: ${Number(completed)} of 2 routine steps done"]`)
    ).not.toBeNull();
  });

  it.each([false, true])(
    "ignores an older refresh that arrives after the tap (save finished: %s)",
    async (saveFinished) => {
      const stale = deferredResponse();
      const save = deferredResponse();
      fetchMock.mockImplementation(async (path) =>
        path === "/api/v1/dashboard" ? Response.json(dashboard(true)) : save.promise
      );
      fetchMock.mockImplementationOnce(() => stale.promise);
      await render();
      const refreshButton = container.querySelector<HTMLButtonElement>(".refresh-button");
      if (!refreshButton) throw new Error("Missing refresh button");
      await click(refreshButton);
      await click(button("Complete Brush teeth"));

      if (saveFinished) await act(async () => save.resolve(Response.json({ ok: true })));
      await act(async () => stale.resolve(Response.json(dashboard())));

      expect(button("Uncheck Brush teeth").getAttribute("aria-pressed")).toBe("true");
      expect(container.querySelector('progress[aria-label="Alex: 1 of 2 routine steps done"]')).not.toBeNull();
      if (!saveFinished) await act(async () => save.resolve(Response.json({ ok: true })));
    }
  );

  it("lets other steps save independently and rolls back only the failed step", async () => {
    const brush = deferredResponse();
    const dress = deferredResponse();
    const saved = dashboard();
    saved.routines[0].steps[1].completed = true;
    saved.routines[0].completedSteps = 1;
    fetchMock.mockImplementation(async (path) => {
      if (path === "/api/v1/dashboard") return Response.json(saved);
      return String(path).endsWith("/brush") ? brush.promise : dress.promise;
    });
    await render();
    await click(button("Complete Brush teeth"));
    await click(button("Complete Get dressed"));
    await act(async () => {
      window.dispatchEvent(new Event("online"));
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(container.querySelector('progress[aria-label="Alex: 2 of 2 routine steps done"]')).not.toBeNull();

    await act(async () => dress.resolve(Response.json({ ok: true })));
    expect(button("Uncheck Get dressed").disabled).toBe(false);
    expect(button("Uncheck Brush teeth").disabled).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(2);

    await act(async () => brush.reject(new Error("Connection lost")));

    expect(button("Complete Brush teeth").disabled).toBe(false);
    expect(button("Uncheck Get dressed").getAttribute("aria-pressed")).toBe("true");
    expect(container.querySelector('progress[aria-label="Alex: 1 of 2 routine steps done"]')).not.toBeNull();
    expect(container.textContent).toContain("Connection lost");
  });

  it("keeps known-offline steps disabled", async () => {
    await render();
    await act(async () => {
      window.dispatchEvent(new Event("offline"));
    });
    await click(button("Complete Brush teeth"));
    expect(button("Complete Brush teeth").disabled).toBe(true);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("tracks the same template step independently for different children", async () => {
    const first = deferredResponse();
    const second = deferredResponse();
    const initial = dashboard();
    initial.children.push({ ...initial.children[0], id: "second-child", name: "Sam" });
    initial.routines.push({
      ...structuredClone(initial.routines[0]),
      id: "second-run",
      owner: "Sam",
      ownerId: "second-child",
      eligibleChildIds: ["second-child"],
    });
    const saved = structuredClone(initial);
    for (const routine of saved.routines) {
      routine.steps[0].completed = true;
      routine.completedSteps = 1;
    }
    fetchMock.mockImplementation(async (path) => {
      if (path === "/api/v1/dashboard") return Response.json(saved);
      return String(path).includes("/second-run/") ? second.promise : first.promise;
    });
    await render(initial);
    await click(button("Complete Brush teeth"));
    await click(button("Complete Brush teeth"));

    expect(container.querySelectorAll('button[aria-label="Uncheck Brush teeth"]')).toHaveLength(2);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    await act(async () => second.resolve(Response.json({ ok: true })));
    const checked = container.querySelectorAll<HTMLButtonElement>('button[aria-label="Uncheck Brush teeth"]');
    expect(checked[0].disabled).toBe(true);
    expect(checked[1].disabled).toBe(false);
    await act(async () => first.resolve(Response.json({ ok: true })));
    expect(button("Uncheck Brush teeth").disabled).toBe(false);
  });

  it("ignores a stale refresh failure after a successful save", async () => {
    const stale = deferredResponse();
    const save = deferredResponse();
    fetchMock.mockImplementation(async (path) =>
      path === "/api/v1/dashboard" ? Response.json(dashboard(true)) : save.promise
    );
    fetchMock.mockImplementationOnce(() => stale.promise);
    await render();
    const refreshButton = container.querySelector<HTMLButtonElement>(".refresh-button");
    if (!refreshButton) throw new Error("Missing refresh button");
    await click(refreshButton);
    await click(button("Complete Brush teeth"));
    await act(async () => save.resolve(Response.json({ ok: true })));
    await act(async () => stale.reject(new Error("Old request failed")));

    expect(button("Uncheck Brush teeth").disabled).toBe(false);
    expect(container.querySelector(".connection")?.textContent).toContain("All synced");
  });
});
