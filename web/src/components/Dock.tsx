import type { AppState, PendingNotification, PinnedItem } from "../types";
import { useT } from "../i18n";

type Decision = "stay" | "later" | "dismiss" | "go_social";

function LockIcon({ locked }: { locked: boolean }) {
  return locked ? (
    <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
      <rect x="5" y="10" width="14" height="10" rx="2.5" fill="none" stroke="currentColor" strokeWidth="1.7" />
      <path d="M8 10V7.5a4 4 0 0 1 8 0V10" fill="none" stroke="currentColor" strokeWidth="1.7" />
    </svg>
  ) : (
    <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
      <rect x="5" y="10" width="14" height="10" rx="2.5" fill="none" stroke="currentColor" strokeWidth="1.7" />
      <path d="M8 10V7.5a4 4 0 0 1 7.4-2" fill="none" stroke="currentColor" strokeWidth="1.7" />
    </svg>
  );
}

function GearIcon() {
  return (
    <svg viewBox="0 0 24 24" width="17" height="17" aria-hidden="true">
      <circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" strokeWidth="1.7" />
      <path
        d="M12 3.5v2M12 18.5v2M3.5 12h2M18.5 12h2M6 6l1.4 1.4M16.6 16.6L18 18M18 6l-1.4 1.4M7.4 16.6L6 18"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function NotificationCard({
  notification,
  now,
  index,
  total,
  onDecision,
  busy,
}: {
  notification: PendingNotification;
  now: number;
  index: number;
  total: number;
  onDecision: (id: string, action: Decision) => void;
  busy: boolean;
}) {
  const { t } = useT();
  const event = notification.event;
  const remaining = Math.max(0, Math.ceil((Date.parse(notification.ready_at) - now) / 1000));
  const wait = notification.wait_seconds;
  const progress = wait > 0 ? Math.min(1, Math.max(0, 1 - remaining / wait)) : 1;
  const circumference = 2 * Math.PI * 19;
  const urgent = event?.classification.decision === "time_sensitive";
  const suggested = event?.classification.suggested_mode ?? "social";

  return (
    <div className={`notif-card ${urgent ? "is-urgent" : ""}`} role="status" aria-live="polite">
      <div className="notif-top">
        <div className="notif-source">
          <span className="source-dot" aria-hidden="true" />
          <span>{event?.source_app ?? "Simulated"}</span>
          <span className="badge badge-sim">{t("misc.demoBadge")}</span>
          {urgent ? <span className="badge badge-urgent">{t("notif.timeSensitive")}</span> : null}
        </div>
        <div className="notif-count">
          {total > 1 ? `${index + 1} / ${total}` : null}
        </div>
      </div>

      <div className="notif-body">
        <div className="notif-copy">
          <h3>{event?.payload.title ?? "New message"}</h3>
          {event?.payload.body ? <p>{event.payload.body}</p> : null}
          <p className="notif-reason">
            {urgent
              ? event?.classification.reason
              : t("notif.held", { mode: event?.classification.suggested_mode ?? "Social" })}
          </p>
        </div>
        <div className="notif-ring" aria-hidden="true">
          <svg viewBox="0 0 44 44" width="44" height="44">
            <circle cx="22" cy="22" r="19" fill="none" stroke="rgba(255,255,255,.12)" strokeWidth="3" />
            <circle
              cx="22"
              cy="22"
              r="19"
              fill="none"
              stroke={urgent ? "#ff8a8a" : "var(--accent, #f0a44a)"}
              strokeWidth="3"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={circumference * (1 - progress)}
              transform="rotate(-90 22 22)"
              style={{ transition: "stroke-dashoffset .25s linear" }}
            />
          </svg>
          <span>{wait > 0 ? remaining : "!"}</span>
        </div>
      </div>

      <div className="notif-actions">
        {urgent ? (
          <>
            <button className="btn btn-ghost" disabled={busy} onClick={() => onDecision(notification.id, "dismiss")}>
              {t("notif.dismiss")}
            </button>
            <button
              className="btn btn-primary"
              disabled={busy || remaining > 0}
              onClick={() => onDecision(notification.id, "go_social")}
            >
              {remaining > 0 ? t("notif.goSocialWait", { seconds: remaining }) : t("notif.goSocial")}
            </button>
          </>
        ) : (
          <>
            <button className="btn btn-ghost" disabled={busy} onClick={() => onDecision(notification.id, "stay")}>
              {t("notif.stay")}
            </button>
            <button className="btn btn-ghost" disabled={busy} onClick={() => onDecision(notification.id, "later")}>
              {t("notif.later")}
            </button>
            <button
              className="btn btn-primary"
              disabled={busy || remaining > 0}
              onClick={() => onDecision(notification.id, "go_social")}
              title={remaining > 0 ? t("notif.waiting", { seconds: remaining }) : t("notif.ready")}
            >
              {remaining > 0
                ? t("notif.goSocialWait", { seconds: remaining })
                : t("notif.goSocial")}
            </button>
            <span className="sr-only">{suggested}</span>
          </>
        )}
      </div>
    </div>
  );
}

export function Dock({
  state,
  onActivate,
  onToggleLock,
  onOpenSettings,
  onPinned,
  onAddApp,
  compact = false,
}: {
  state: AppState;
  onActivate: (id: string) => void;
  onToggleLock: () => void;
  onOpenSettings: () => void;
  onPinned: (item: PinnedItem) => void;
  onAddApp: () => void;
  compact?: boolean;
}) {
  const { t } = useT();
  const active = state.modes.find((m) => m.id === state.active_mode) ?? state.modes[0];

  return (
    <div className={`dock-wrap ${compact ? "is-compact" : ""}`}>
      <div className="dock" role="toolbar" aria-label={t("dock.label")}>
        <div className="dock-modes">
          {state.modes.map((mode) => {
            const isActive = mode.id === state.active_mode;
            return (
              <button
                key={mode.id}
                type="button"
                className={`mode-pill mode-${mode.color} ${isActive ? "is-active" : ""}`}
                aria-pressed={isActive}
                onClick={() => onActivate(mode.id)}
                title={`${mode.name} · v${mode.version}`}
              >
                <span className="mode-glyph" aria-hidden="true">
                  {mode.icon}
                </span>
                <span className="mode-name">{mode.name}</span>
                {isActive ? <span className="mode-active-dot" aria-hidden="true" /> : null}
              </button>
            );
          })}
        </div>

        <div className="dock-divider" aria-hidden="true" />

        <div className="dock-apps" aria-label={t("modes.pinned")}>
          {active?.pinned_items.slice(0, 5).map((item, index) => (
            <button
              key={item.id}
              type="button"
              className={`app-tile ${state.bridge.connected && index < 2 ? "is-running" : ""}`}
              onClick={() => onPinned(item)}
              title={item.kind === "bookmark" ? item.url : `${item.label} — native launch`}
            >
              <span aria-hidden="true">{item.icon}</span>
              <span className="app-label">{item.label}</span>
            </button>
          ))}
          <button
            className="app-tile app-add"
            type="button"
            onClick={onAddApp}
            title={t("native.addTitle")}
          >
            <span aria-hidden="true">＋</span>
            <span className="app-label">{t("native.addShort")}</span>
          </button>
        </div>

        <div className="dock-actions">
          <button
            type="button"
            className={`icon-btn ${state.runtime.manual_lock ? "is-on" : ""}`}
            onClick={onToggleLock}
            aria-pressed={state.runtime.manual_lock}
            title={state.runtime.manual_lock ? t("focus.unlock") : t("focus.lock")}
          >
            <LockIcon locked={state.runtime.manual_lock} />
          </button>
          <button type="button" className="icon-btn" onClick={onOpenSettings} title={t("nav.settings")}>
            <GearIcon />
          </button>
        </div>
      </div>
      <div className="dock-shadow" aria-hidden="true" />
    </div>
  );
}
