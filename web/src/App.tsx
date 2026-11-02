import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api, ApiError } from "./api";
import { I18nProvider, useT, type TranslationKey } from "./i18n";
import { useAppState, useNow } from "./useAppState";
import { Dock, NotificationCard } from "./components/Dock";
import { FocusView } from "./components/FocusView";
import { TimelineView } from "./components/TimelineView";
import { ModesView } from "./components/ModesView";
import { AIStudio } from "./components/AIStudio";
import { SettingsView } from "./components/SettingsView";
import { PermissionsView } from "./components/PermissionsView";
import { NativeAppPicker, type NativeApp } from "./components/NativeAppPicker";
import type { AppState, Mode, PinnedItem } from "./types";

type View = "focus" | "timeline" | "modes" | "ai" | "settings" | "permissions";
type DemoKind = "slack" | "urgent" | "activity" | "burst";
type Toast = { message: string; kind: "ok" | "error" };
type SocialGate = { item: PinnedItem; deadline: number };

function modeBody(mode: Mode, pinned: PinnedItem[]) {
  return {
    name: mode.name,
    color: mode.color,
    icon: mode.icon,
    pinned_items: pinned,
    activity_app_allowlist: mode.activity_app_allowlist,
    keywords: mode.keywords,
    transition: mode.transition,
    notifications: mode.notifications,
    sort_order: mode.sort_order,
  };
}

const NAV: { id: View; key: TranslationKey }[] = [
  { id: "focus", key: "nav.focus" },
  { id: "timeline", key: "nav.timeline" },
  { id: "modes", key: "nav.modes" },
  { id: "ai", key: "nav.ai" },
  { id: "settings", key: "nav.settings" },
  { id: "permissions", key: "nav.permissions" },
];

function Brand() {
  return (
    <div className="brand">
      <span className="brand-mark" aria-hidden="true">
        <span />
        <span />
        <span />
      </span>
      <span className="brand-name">
        FocusDock <em>AI</em>
      </span>
    </div>
  );
}

function Shell({
  state,
  refresh,
  live,
}: {
  state: AppState;
  refresh: () => Promise<void>;
  live: boolean;
}) {
  const { t } = useT();
  const now = useNow(250);
  const [view, setView] = useState<View>("focus");
  const [toast, setToast] = useState<Toast | null>(null);
  const [busy, setBusy] = useState(false);
  const [dismissedSuggestion, setDismissedSuggestion] = useState<string | null>(null);
  const [socialGate, setSocialGate] = useState<SocialGate | null>(null);
  const [appPickerOpen, setAppPickerOpen] = useState(false);
  const toastTimer = useRef<number | null>(null);
  const dockOnly = window.location.pathname === "/dock";

  const notify = useCallback((message: string, kind: "ok" | "error" = "ok") => {
    setToast({ message, kind });
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 3200);
  }, []);

  useEffect(() => {
    document.documentElement.lang = state.settings.language === "zh" ? "zh-CN" : "en";
    document.title = `FocusDock AI — ${state.modes.find((m) => m.id === state.active_mode)?.name ?? ""}`;
  }, [state.settings.language, state.active_mode, state.modes]);

  useEffect(
    () => () => {
      if (toastTimer.current) window.clearTimeout(toastTimer.current);
    },
    [],
  );

  const activate = async (id: string) => {
    if (id === state.active_mode) return;
    try {
      await api(`/api/modes/${id}/activate`, { method: "POST", body: { lock: true } });
      setDismissedSuggestion(null);
      await refresh();
    } catch (cause) {
      notify(cause instanceof Error ? cause.message : t("common.error"), "error");
    }
  };

  const toggleLock = async () => {
    try {
      await api("/api/runtime/lock", {
        method: "POST",
        body: { locked: !state.runtime.manual_lock },
      });
      await refresh();
    } catch (cause) {
      notify(cause instanceof Error ? cause.message : t("common.error"), "error");
    }
  };

  const setLanguage = async (language: "en" | "zh") => {
    try {
      await api("/api/settings", { method: "PUT", body: { language } });
      await refresh();
    } catch (cause) {
      notify(cause instanceof Error ? cause.message : t("common.error"), "error");
    }
  };

  const demo = async (kind: DemoKind) => {
    setBusy(true);
    try {
      if (kind === "slack") {
        await api("/api/demo/notification", {
          method: "POST",
          body: {
            source_app: "Slack (simulated)",
            title: "Maya Chen in #launch",
            body: "Can you take a look at the launch copy before 4?",
          },
        });
      } else if (kind === "urgent") {
        await api("/api/demo/notification", {
          method: "POST",
          body: {
            source_app: "Pager (simulated)",
            title: "Production incident",
            body: "Checkout errors are spiking — urgent",
            time_sensitive: true,
          },
        });
      } else if (kind === "activity") {
        await api("/api/demo/activity", {
          method: "POST",
          body: {
            app_name: "Visual Studio Code",
            app_id: "com.microsoft.VSCode",
            stable_seconds: 20,
          },
        });
      } else {
        await api("/api/demo/burst", { method: "POST", body: { count: 50 } });
      }
      await refresh();
      notify(t("misc.demoCreated"));
    } catch (cause) {
      notify(cause instanceof Error ? cause.message : t("common.error"), "error");
    } finally {
      setBusy(false);
    }
  };

  const decide = async (id: string, action: "stay" | "later" | "dismiss" | "go_social") => {
    setBusy(true);
    try {
      await api(`/api/notifications/${id}/decision`, { method: "POST", body: { action } });
      await refresh();
    } catch (cause) {
      if (cause instanceof ApiError) notify(cause.message, "error");
      else notify(t("common.error"), "error");
    } finally {
      setBusy(false);
    }
  };

  const launchNative = async (item: PinnedItem, confirmSocial = false) => {
    if (!item.bundle_id) {
      notify(t("misc.nativeUnavailable"), "error");
      return;
    }
    try {
      await api("/api/native/launch", {
        method: "POST",
        body: {
          id: item.bundle_id,
          label: item.label,
          confirm_social: confirmSocial,
        },
      });
      notify(t("misc.nativeLaunched", { label: item.label }));
    } catch (cause) {
      if (cause instanceof ApiError && cause.code === "social_pause_required") {
        const data = (cause.body ?? {}) as { wait_seconds?: number };
        const wait = Math.max(1, Number(data.wait_seconds ?? 30));
        setSocialGate({ item, deadline: Date.now() + wait * 1000 });
        return;
      }
      if (cause instanceof ApiError) notify(cause.message, "error");
      else notify(cause instanceof Error ? cause.message : t("common.error"), "error");
    }
  };

  const pinned = (item: PinnedItem) => {
    if (item.kind === "bookmark" && item.url) {
      window.open(item.url, "_blank", "noopener,noreferrer");
      return;
    }
    if (item.kind === "app" && item.bundle_id) {
      void launchNative(item);
      return;
    }
    notify(`${item.label}: ${t("misc.nativeUnavailable")}`, "error");
  };

  const pinNativeApp = async (app: NativeApp) => {
    const mode = state.modes.find((item) => item.id === state.active_mode);
    if (!mode) return;
    if (mode.pinned_items.some((item) => item.bundle_id === app.id)) {
      notify(t("native.alreadyPinned", { label: app.name }), "error");
      return;
    }
    const id = `native-${app.id}`.slice(0, 64);
    try {
      await api(`/api/modes/${mode.id}`, {
        method: "PUT",
        body: modeBody(mode, [
          ...mode.pinned_items,
          { id, label: app.name, icon: "▣", kind: "app", bundle_id: app.id },
        ]),
      });
      await refresh();
      notify(t("native.pinned", { label: app.name }));
      setAppPickerOpen(false);
    } catch (cause) {
      notify(cause instanceof Error ? cause.message : t("common.error"), "error");
    }
  };

  const pending = state.pending_notifications;
  const first = pending[0];
  const nativePlatform = state.bridge.capabilities?.platform;
  const socialSeconds = socialGate
    ? Math.max(0, Math.ceil((socialGate.deadline - now) / 1000))
    : 0;
  const nativeLabel = state.bridge.connected
    ? nativePlatform === "windows"
      ? t("native.windowsConnected")
      : nativePlatform === "macos"
        ? t("native.macosConnected")
        : t("native.connected")
    : t("native.webOnly");

  const body = useMemo(() => {
    switch (view) {
      case "timeline":
        return <TimelineView state={state} />;
      case "modes":
        return <ModesView state={state} onChanged={refresh} notify={notify} />;
      case "ai":
        return <AIStudio state={state} onChanged={refresh} notify={notify} />;
      case "settings":
        return <SettingsView state={state} onChanged={refresh} notify={notify} />;
      case "permissions":
        return <PermissionsView state={state} onChanged={refresh} notify={notify} />;
      default:
        return (
          <FocusView
            state={state}
            now={now}
            onActivate={activate}
            onToggleLock={toggleLock}
            onDemo={demo}
            onOpenTimeline={() => setView("timeline")}
            onOpenModes={() => setView("modes")}
            busy={busy}
            dismissedSuggestion={dismissedSuggestion}
            onDismissSuggestion={() =>
              setDismissedSuggestion(state.runtime.last_suggested_mode ?? null)
            }
          />
        );
    }
  }, [view, state, now, busy, dismissedSuggestion, notify]);

  if (dockOnly) {
    return (
      <div className="dock-only">
        {first ? (
          <div className="notification-layer is-dock-only">
            <NotificationCard
              notification={first}
              now={now}
              index={0}
              total={pending.length}
              onDecision={decide}
              busy={busy}
            />
          </div>
        ) : null}
        <Dock
          state={state}
          onActivate={activate}
          onToggleLock={toggleLock}
          onOpenSettings={() => {
            window.location.href = "/";
          }}
          onPinned={pinned}
          onAddApp={() => {
            window.location.href = "/";
          }}
          compact
        />
        {toast ? <div className={`toast toast-${toast.kind}`}>{toast.message}</div> : null}
      </div>
    );
  }

  return (
    <div className="app">
      <a className="skip-link" href="#stage">
        Skip to content
      </a>

      <header className="topbar">
        <Brand />
        <nav className="tabs" aria-label="Primary">
          {NAV.map((item) => (
            <button
              key={item.id}
              type="button"
              className={view === item.id ? "is-active" : ""}
              aria-current={view === item.id ? "page" : undefined}
              onClick={() => setView(item.id)}
            >
              {t(item.key)}
            </button>
          ))}
        </nav>
        <div className="top-status">
          <span className={`live-dot ${live ? "is-live" : ""}`} aria-hidden="true" />
          <span>{live ? t("misc.connected") : t("misc.offline")}</span>
          <span className={`native-status ${state.bridge.connected ? "is-connected" : ""}`}>
            {nativeLabel}
          </span>
          <button
            className="lang-switch"
            type="button"
            onClick={() => void setLanguage(state.settings.language === "zh" ? "en" : "zh")}
            title={state.settings.language === "zh" ? "Switch to English" : "切换到中文"}
          >
            {state.settings.language === "zh" ? "EN" : "中文"}
          </button>
          <span className="version">v{state.version}</span>
        </div>
      </header>

      <main className="stage" id="stage">
        {body}
      </main>

      <div className="notification-layer">
        {first ? (
          <NotificationCard
            notification={first}
            now={now}
            index={0}
            total={pending.length}
            onDecision={decide}
            busy={busy}
          />
        ) : null}
      </div>

      <Dock
        state={state}
        onActivate={activate}
        onToggleLock={toggleLock}
        onOpenSettings={() => setView("settings")}
        onPinned={pinned}
        onAddApp={() => setAppPickerOpen(true)}
      />

      <NativeAppPicker
        open={appPickerOpen}
        onClose={() => setAppPickerOpen(false)}
        onPin={(app) => void pinNativeApp(app)}
        onLaunch={(app) => {
          setAppPickerOpen(false);
          void launchNative({
            id: `native-${app.id}`.slice(0, 64),
            label: app.name,
            icon: "▣",
            kind: "app",
            bundle_id: app.id,
          });
        }}
      />

      {socialGate ? (
        <div className="social-gate" role="dialog" aria-modal="true" aria-label={t("social.title")}>
          <div className="social-gate-card">
            <span className="badge badge-urgent">{t("social.badge")}</span>
            <h2>{socialSeconds > 0 ? t("social.title") : t("social.ready")}</h2>
            <p>{t("social.body", { label: socialGate.item.label, seconds: socialSeconds })}</p>
            <p className="panel-note">{t("social.outside")}</p>
            <div className="panel-actions">
              <button className="btn btn-ghost" type="button" onClick={() => setSocialGate(null)}>
                {t("common.cancel")}
              </button>
              <button
                className="btn btn-primary"
                type="button"
                disabled={socialSeconds > 0}
                onClick={() => {
                  const item = socialGate.item;
                  setSocialGate(null);
                  void launchNative(item, true);
                }}
              >
                {socialSeconds > 0
                  ? t("social.wait", { seconds: socialSeconds })
                  : t("social.openNow")}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {toast ? (
        <div className={`toast toast-${toast.kind}`} role="status">
          {toast.message}
        </div>
      ) : null}
    </div>
  );
}

export default function App() {
  const { state, refresh, error, live } = useAppState();
  const dockOnly = window.location.pathname === "/dock";

  if (!state) {
    return (
      <div className={`boot ${dockOnly ? "is-dock" : ""}`}>
        <Brand />
        <div className="boot-line" />
        {error ? (
          <>
            <p className="boot-error">{error}</p>
            <button className="btn btn-ghost" type="button" onClick={() => void refresh()}>
              Retry
            </button>
          </>
        ) : (
          <p className="boot-text">Starting your local session…</p>
        )}
      </div>
    );
  }

  return (
    <I18nProvider lang={state.settings.language}>
      <Shell state={state} refresh={refresh} live={live} />
    </I18nProvider>
  );
}
