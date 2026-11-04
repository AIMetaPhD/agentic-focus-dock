import { describe, expect, it } from "vitest";
import { DEFAULT_MODES, type SeedMode } from "../src/domain/defaults";
import { modeInputSchema, type Mode } from "../src/domain/schemas";
import {
  classifyActivity,
  classifyNotification,
  type RuntimeState,
} from "../src/domain/rules";

function toMode(seed: SeedMode): Mode {
  return {
    id: seed.id,
    ...modeInputSchema.parse(seed),
    version: 1,
    is_builtin: true,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
  };
}

const modes = DEFAULT_MODES.map(toMode);
const writing = modes.find((m) => m.id === "writing")!;
const building = modes.find((m) => m.id === "building")!;
const social = modes.find((m) => m.id === "social")!;

const idle: RuntimeState = {
  active_mode: "writing",
  manual_lock: false,
  last_suggestion_at: null,
  last_suggested_mode: null,
};

function activity(app: string, stable = 20) {
  return {
    source_app: app,
    payload: { app_name: app, app_id: app, stable_seconds: stable },
  } as const;
}

describe("classifyActivity", () => {
  it("suggests a mode after the dwell time", () => {
    const result = classifyActivity(activity("com.microsoft.VSCode"), writing, modes, idle);
    expect(result.decision).toBe("suggest_switch");
    expect(result.suggested_mode).toBe("building");
    expect(result.confidence).toBeGreaterThan(0.8);
    expect(result.engine).toBe("rules");
  });

  it("holds before the dwell time", () => {
    const result = classifyActivity(activity("com.microsoft.VSCode", 5), writing, modes, idle);
    expect(result.decision).toBe("hold");
    expect(result.matched_rule).toBe("dwell");
  });

  it("stays when the app belongs to the current mode", () => {
    const result = classifyActivity(activity("com.google.Chrome"), writing, modes, idle);
    expect(result.decision).toBe("stay");
    expect(result.matched_rule).toBe("current-mode");
  });

  it("never auto-switches while manual lock is on", () => {
    const unlockedBuilding = { ...building, transition: { ...building.transition, auto_suggest_only: false } };
    const unlockedWriting = { ...writing, transition: { ...writing.transition, auto_suggest_only: false } };
    const locked = classifyActivity(
      activity("com.microsoft.VSCode"),
      unlockedWriting,
      [unlockedWriting, unlockedBuilding, social],
      { ...idle, manual_lock: true },
    );
    expect(locked.decision).toBe("hold");
    expect(locked.matched_rule).toBe("manual-lock");
  });

  it("auto-switches only when both modes allow it", () => {
    const unlockedBuilding = { ...building, transition: { ...building.transition, auto_suggest_only: false } };
    const unlockedWriting = { ...writing, transition: { ...writing.transition, auto_suggest_only: false } };
    const result = classifyActivity(activity("com.microsoft.VSCode"), unlockedWriting, [unlockedWriting, unlockedBuilding], idle);
    expect(result.decision).toBe("auto_switch");
  });

  it("suppresses repeated suggestions during cooldown", () => {
    const result = classifyActivity(activity("com.microsoft.VSCode"), writing, modes, {
      ...idle,
      last_suggestion_at: new Date(Date.now() - 10_000).toISOString(),
      last_suggested_mode: null,
    });
    expect(result.decision).toBe("hold");
    expect(result.matched_rule).toBe("cooldown");
  });

  it("does not repeat a pending suggestion after cooldown", () => {
    const result = classifyActivity(activity("code.exe", 90), writing, modes, {
      ...idle,
      last_suggested_mode: "building",
      last_suggestion_at: new Date(Date.now() - 90000).toISOString(),
    });
    expect(result.matched_rule).toBe("pending-suggestion");
    expect(result.decision).toBe("hold");
  });

  it("is conservative for unknown apps", () => {
    const result = classifyActivity(activity("com.example.Unknown"), writing, modes, idle);
    expect(result.decision).toBe("stay");
    expect(result.confidence).toBeLessThan(0.5);
  });
});

describe("classifyNotification", () => {
  it("defers social messages during Writing with a Social suggestion", () => {
    const result = classifyNotification(
      { source_app: "Slack (simulated)", payload: { title: "Maya in #launch", body: "Can you review?" } },
      writing,
      modes,
    );
    expect(result.decision).toBe("defer");
    expect(result.suggested_mode).toBe("social");
    expect(result.matched_rule).toBe("social-defer");
  });

  it("always surfaces time-sensitive messages", () => {
    const result = classifyNotification(
      { source_app: "Pager", payload: { title: "Incident", body: "Production outage", time_sensitive: true } },
      writing,
      modes,
    );
    expect(result.decision).toBe("time_sensitive");
    expect(result.confidence).toBeGreaterThan(0.9);
  });

  it("detects urgent keywords without the flag", () => {
    const result = classifyNotification(
      { source_app: "Slack", payload: { title: "Deadline moved", body: "This is urgent, ASAP" } },
      writing,
      modes,
    );
    expect(result.decision).toBe("time_sensitive");
  });

  it("shows notifications by default in Break", () => {
    const breakMode = modes.find((m) => m.id === "break")!;
    const result = classifyNotification(
      { source_app: "Slack", payload: { title: "Weekly update" } },
      breakMode,
      modes,
    );
    expect(result.decision).toBe("show");
  });

  it("handles 50 mixed notifications deterministically", () => {
    let urgent = 0;
    let deferred = 0;
    for (let i = 0; i < 50; i += 1) {
      const isUrgent = i % 7 === 0;
      const result = classifyNotification(
        {
          source_app: isUrgent ? "Pager" : "Slack",
          payload: {
            title: isUrgent ? "Incident urgent" : `Message ${i}`,
            time_sensitive: isUrgent,
          },
        },
        writing,
        modes,
      );
      if (result.decision === "time_sensitive") urgent += 1;
      if (result.decision === "defer") deferred += 1;
    }
    expect(urgent).toBe(8);
    expect(deferred).toBe(42);
  });
});
