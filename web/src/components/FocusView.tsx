import { useEffect, useState } from "react";
import { api } from "../api";
import { useT, type TranslationKey } from "../i18n";
import type { ActivityEvent, AppState } from "../types";

function formatClock(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(total / 60)
    .toString()
    .padStart(2, "0");
  const seconds = (total % 60).toString().padStart(2, "0");
  return `${minutes}:${seconds}`;
}

function timeAgo(iso: string, lang: "en" | "zh"): string {
  const diff = Math.max(0, Date.now() - Date.parse(iso));
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return lang === "zh" ? "刚刚" : "just now";
  if (minutes < 60) return lang === "zh" ? `${minutes} 分钟前` : `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  return lang === "zh" ? `${hours} 小时前` : `${hours}h ago`;
}

export function FocusView({
  state,
  now,
  onActivate,
  onToggleLock,
  onDemo,
  onOpenTimeline,
  onOpenModes,
  busy,
  dismissedSuggestion,
  onDismissSuggestion,
}: {
  state: AppState;
  now: number;
  onActivate: (id: string) => void;
  onToggleLock: () => void;
  onDemo: (kind: "slack" | "urgent" | "activity" | "burst") => void;
  onOpenTimeline: () => void;
  onOpenModes: () => void;
  busy: boolean;
  dismissedSuggestion: string | null;
  onDismissSuggestion: () => void;
}) {
  const { t, lang } = useT();
  const active = state.modes.find((m) => m.id === state.active_mode) ?? state.modes[0];
  const suggested = state.modes.find((m) => m.id === state.runtime.last_suggested_mode);
  const [startedAt, setStartedAt] = useState(() => Date.now());
  const [events, setEvents] = useState<ActivityEvent[]>([]);

  useEffect(() => {
    setStartedAt(Date.now());
  }, [state.active_mode]);

  useEffect(() => {
    let cancelled = false;
    void api<ActivityEvent[]>("/api/events?limit=6")
      .then((rows) => {
        if (!cancelled) setEvents(rows);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [state.counts.events]);

  if (!active) return null;

  const pending = state.pending_notifications;
  const showSuggestion =
    suggested &&
    suggested.id !== active.id &&
    dismissedSuggestion !== suggested.id &&
    state.runtime.last_suggested_mode !== null;

  return (
    <div className="view focus-view">
      <section className={`hero mode-${active.color}`}>
        <div className="hero-copy">
          <span className="eyebrow">{t("focus.currentMode")}</span>
          <h1 className="hero-title">
            {active.name}
            <span className="hero-period">.</span>
          </h1>
          <p className="hero-sub">{t("app.tagline")}</p>

          <div className="hero-meta">
            <button
              type="button"
              className={`status-chip ${state.runtime.manual_lock ? "is-locked" : ""}`}
              onClick={onToggleLock}
              aria-pressed={state.runtime.manual_lock}
            >
              <span className="status-led" aria-hidden="true" />
              {state.runtime.manual_lock ? t("focus.locked") : t("focus.unlocked")}
            </button>
            <button type="button" className="text-btn" onClick={onOpenModes}>
              {t("focus.edit")} →
            </button>
          </div>

          <div className="hero-stats">
            <div>
              <strong>{String(pending.length).padStart(2, "0")}</strong>
              <span>{t("focus.held")}</span>
            </div>
            <div>
              <strong>{String(state.counts.events).padStart(2, "0")}</strong>
              <span>{t("focus.events")}</span>
            </div>
            <div>
              <strong>{active.pinned_items.length}</strong>
              <span>{t("modes.pinned")}</span>
            </div>
          </div>
        </div>

        <div className="hero-dial" aria-hidden="true">
          <div className="dial-ring" />
          <div className="dial-inner">
            <span className="dial-glyph">{active.icon}</span>
            <span className="dial-time">{formatClock(now - startedAt)}</span>
            <span className="dial-label">{t("focus.uptime")}</span>
          </div>
          <div className="dial-spark spark-a" />
          <div className="dial-spark spark-b" />
        </div>
      </section>

      {showSuggestion ? (
        <section className="suggestion" role="status">
          <div className="suggestion-icon" aria-hidden="true">
            {suggested.icon}
          </div>
          <div className="suggestion-copy">
            <strong>{t("focus.suggestion", { mode: suggested.name })}</strong>
            <span>
              {t("focus.suggestionWhy", {
                seconds: suggested.transition.dwell_seconds,
              })}
            </span>
          </div>
          <div className="suggestion-actions">
            <button className="btn btn-ghost" type="button" onClick={onDismissSuggestion}>
              {t("focus.dismiss")}
            </button>
            <button className="btn btn-primary" type="button" onClick={() => onActivate(suggested.id)}>
              {t("focus.switchTo", { mode: suggested.name })}
            </button>
          </div>
        </section>
      ) : null}

      <div className="grid-2">
        <section className="panel">
          <header className="panel-head">
            <div>
              <span className="eyebrow">{t("focus.modeFit")}</span>
              <h2>{t("focus.recent")}</h2>
            </div>
            <button className="text-btn" type="button" onClick={onOpenTimeline}>
              {t("focus.viewAll")} →
            </button>
          </header>
          <ul className="event-list">
            {events.length === 0 ? <li className="empty">{t("focus.modeFitEmpty")}</li> : null}
            {events.map((event) => (
              <li key={event.id} className="event-row">
                <span className={`event-mark source-${event.source}`} aria-hidden="true" />
                <div className="event-main">
                  <span className="event-title">
                    {event.kind === "notification"
                      ? event.payload.title ?? "Notification"
                      : event.payload.app_name ?? event.source_app}
                  </span>
                  <span className="event-meta">
                    {t(`source.${event.source}` as TranslationKey)} ·{" "}
                    {event.classification.decision} · {timeAgo(event.timestamp, lang)}
                  </span>
                </div>
                <span className={`decision decision-${event.classification.decision}`}>
                  {event.classification.confidence.toFixed(2)}
                </span>
              </li>
            ))}
          </ul>
        </section>

        <section className="panel demo-panel">
          <header className="panel-head">
            <div>
              <span className="eyebrow">Sandbox</span>
              <h2>{t("focus.demo")}</h2>
            </div>
            <span className="badge badge-sim">{t("misc.demoBadge")}</span>
          </header>
          <p className="panel-note">{t("focus.demoHint")}</p>
          <div className="demo-grid">
            <button className="demo-btn" type="button" disabled={busy} onClick={() => onDemo("slack")}>
              <span className="demo-icon">◈</span>
              <span>{t("focus.demoSlack")}</span>
            </button>
            <button className="demo-btn is-urgent" type="button" disabled={busy} onClick={() => onDemo("urgent")}>
              <span className="demo-icon">!</span>
              <span>{t("focus.demoUrgent")}</span>
            </button>
            <button className="demo-btn" type="button" disabled={busy} onClick={() => onDemo("activity")}>
              <span className="demo-icon">⌨</span>
              <span>{t("focus.demoActivity")}</span>
            </button>
            <button className="demo-btn" type="button" disabled={busy} onClick={() => onDemo("burst")}>
              <span className="demo-icon">≋</span>
              <span>{t("focus.demoBurst")}</span>
            </button>
          </div>
          <div className="demo-foot">
            <span className="live-dot" aria-hidden="true" />
            {t("app.live")}
          </div>
        </section>
      </div>

      <section className="panel held-panel">
        <header className="panel-head">
          <div>
            <span className="eyebrow">{t("focus.pending")}</span>
            <h2>
              {pending.length > 0
                ? `${pending.length} ${t("focus.held")}`
                : t("focus.quiet")}
            </h2>
          </div>
          <div className="pending-count">{pending.length}</div>
        </header>
        {pending.length === 0 ? (
          <p className="panel-note">{t("focus.noPending")}</p>
        ) : (
          <ul className="held-list">
            {pending.slice(0, 3).map((item) => (
              <li key={item.id}>
                <span className="held-source">{item.event?.source_app}</span>
                <span className="held-title">{item.event?.payload.title}</span>
                <span className="held-badge">{t("misc.demoBadge")}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
