import type {
  ActivityEvent,
  Classification,
  Mode,
} from "./schemas";
import { SOCIAL_APP_HINTS, URGENT_KEYWORDS } from "./defaults";

export type RuntimeState = {
  active_mode: string;
  manual_lock: boolean;
  last_suggestion_at: string | null;
  last_suggested_mode: string | null;
};

function norm(value: string | undefined | null): string {
  return (value ?? "").toLowerCase();
}

function matchesMode(mode: Mode, appId: string, appName: string): boolean {
  const id = norm(appId);
  const name = norm(appName);
  if (
    mode.activity_app_allowlist.some((entry) => {
      const e = norm(entry);
      return e === id || e === name || (e.length > 3 && (id.includes(e) || name.includes(e)));
    })
  ) {
    return true;
  }
  return mode.keywords.some((keyword) => {
    const k = norm(keyword);
    return k.length > 2 && (name.includes(k) || id.includes(k));
  });
}

export function findModeForApp(modes: Mode[], appId: string, appName: string): { mode: Mode; why: string } | null {
  for (const mode of modes) {
    if (mode.activity_app_allowlist.some((entry) => norm(entry) === norm(appId) || norm(entry) === norm(appName))) {
      return { mode, why: `allowlist match for ${appId || appName}` };
    }
  }
  for (const mode of modes) {
    if (matchesMode(mode, appId, appName)) return { mode, why: `keyword match for ${appName || appId}` };
  }
  return null;
}

export function isManualLockActive(state: RuntimeState): boolean {
  return state.manual_lock;
}

/**
 * Deterministic activity classifier. No network, no model.
 * Dwell time and cooldown prevent mode flapping when the user alt-tabs quickly.
 */
export function classifyActivity(
  event: Pick<ActivityEvent, "payload" | "source_app">,
  activeMode: Mode,
  modes: Mode[],
  state: RuntimeState,
): Classification {
  const appId = event.payload.app_id ?? event.source_app;
  const appName = event.payload.app_name ?? event.source_app;
  const match = findModeForApp(modes, appId, appName);

  if (!match) {
    return {
      mode: activeMode.id,
      decision: "stay",
      confidence: 0.35,
      reason: `No mode claims ${appName || appId}; staying in ${activeMode.name}.`,
      engine: "rules",
      matched_rule: "no-match",
    };
  }

  if (match.mode.id === activeMode.id) {
    return {
      mode: activeMode.id,
      decision: "stay",
      confidence: 0.95,
      reason: `${appName || appId} already belongs to the current mode.`,
      engine: "rules",
      matched_rule: "current-mode",
    };
  }

  const stable = event.payload.stable_seconds ?? 0;
  const dwell = Math.max(match.mode.transition.dwell_seconds, activeMode.transition.dwell_seconds);
  if (stable < dwell) {
    return {
      mode: activeMode.id,
      decision: "hold",
      suggested_mode: match.mode.id,
      confidence: 0.5,
      reason: `Needs ${dwell}s of stable focus in ${appName || appId} (currently ${Math.round(stable)}s).`,
      engine: "rules",
      matched_rule: "dwell",
    };
  }

  if (state.last_suggestion_at && state.last_suggested_mode) {
    const elapsed = (Date.now() - Date.parse(state.last_suggestion_at)) / 1000;
    const cooldown = Math.max(activeMode.transition.cooldown_seconds, match.mode.transition.cooldown_seconds);
    if (elapsed < cooldown) {
      return {
        mode: activeMode.id,
        decision: "hold",
        suggested_mode: match.mode.id,
        confidence: 0.6,
        reason: `Cooldown active for ${Math.ceil(cooldown - elapsed)}s more to avoid flapping.`,
        engine: "rules",
        matched_rule: "cooldown",
      };
    }
  }

  const canAuto =
    !state.manual_lock &&
    !match.mode.transition.auto_suggest_only &&
    !activeMode.transition.auto_suggest_only;

  return {
    mode: activeMode.id,
    decision: canAuto ? "auto_switch" : "suggest_switch",
    suggested_mode: match.mode.id,
    confidence: 0.9,
    reason: state.manual_lock
      ? `${appName || appId} fits ${match.mode.name}, but manual lock is on; suggestion only.`
      : `${appName || appId} fits ${match.mode.name} (${match.why}).`,
    engine: "rules",
    matched_rule: "allowlist",
  };
}

function isSocial(sourceApp: string, category?: string): boolean {
  const hay = `${norm(sourceApp)} ${norm(category)}`;
  return SOCIAL_APP_HINTS.some((hint) => hay.includes(hint));
}

export function classifyNotification(
  event: Pick<ActivityEvent, "payload" | "source_app">,
  activeMode: Mode,
  modes: Mode[],
): Classification {
  const text = `${event.payload.title ?? ""} ${event.payload.body ?? ""}`.toLowerCase();
  const urgent =
    event.payload.time_sensitive === true ||
    URGENT_KEYWORDS.some((keyword) => text.includes(keyword.toLowerCase()));

  if (urgent) {
    return {
      mode: activeMode.id,
      decision: "time_sensitive",
      confidence: 0.97,
      reason: "Time-sensitive signal detected; shown immediately regardless of mode.",
      engine: "rules",
      matched_rule: "urgent",
    };
  }

  const socialMode = modes.find((m) => m.id === "social");
  if (isSocial(event.source_app, event.payload.category) && activeMode.id !== "social") {
    if (activeMode.notifications.default === "show") {
      return {
        mode: activeMode.id,
        decision: "show",
        confidence: 0.8,
        reason: `${activeMode.name} lets social notifications through.`,
        engine: "rules",
        matched_rule: "social-show",
      };
    }
    return {
      mode: activeMode.id,
      decision: "defer",
      suggested_mode: socialMode?.id ?? null,
      confidence: 0.86,
      reason: `Social message during ${activeMode.name}; held in the product queue with an optional switch.`,
      engine: "rules",
      matched_rule: "social-defer",
    };
  }

  const relevant = activeMode.keywords.some((keyword) => {
    const k = keyword.toLowerCase();
    return k.length > 2 && text.includes(k);
  });
  if (relevant && activeMode.notifications.default !== "ignore") {
    return {
      mode: activeMode.id,
      decision: "show",
      confidence: 0.78,
      reason: `Message mentions ${activeMode.name.toLowerCase()} work; shown inline.`,
      engine: "rules",
      matched_rule: "relevant",
    };
  }

  if (activeMode.notifications.default === "ignore") {
    return {
      mode: activeMode.id,
      decision: "ignore",
      confidence: 0.7,
      reason: `${activeMode.name} ignores non-urgent notifications by policy.`,
      engine: "rules",
      matched_rule: "default-ignore",
    };
  }

  if (activeMode.notifications.default === "show") {
    return {
      mode: activeMode.id,
      decision: "show",
      confidence: 0.7,
      reason: `${activeMode.name} shows notifications by policy.`,
      engine: "rules",
      matched_rule: "default-show",
    };
  }

  return {
    mode: activeMode.id,
    decision: "defer",
    confidence: 0.75,
    reason: `Non-urgent message deferred by ${activeMode.name} policy.`,
    engine: "rules",
    matched_rule: "default-defer",
  };
}

export function actualActionFor(classification: Classification): ActivityEvent["actual_action"] {
  switch (classification.decision) {
    case "suggest_switch":
      return "suggested";
    case "auto_switch":
      return "switched";
    case "defer":
      return "queued_in_app";
    case "show":
    case "time_sensitive":
      return "shown";
    case "ignore":
      return "none";
    default:
      return "none";
  }
}
