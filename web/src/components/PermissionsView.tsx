import { api } from "../api";
import { useT } from "../i18n";
import type { AppState } from "../types";

export function PermissionsView({
  state,
  onChanged,
  notify,
}: {
  state: AppState;
  onChanged: () => Promise<void>;
  notify: (message: string, kind?: "ok" | "error") => void;
}) {
  const { t } = useT();
  const caps = state.capabilities;
  const bridgeConnected = state.bridge.connected;
  const isMac = caps.platform === "darwin";

  const rotate = async () => {
    try {
      await api("/api/bridge/rotate-token", { method: "POST" });
      await onChanged();
      notify(t("perm.rotated"));
    } catch (cause) {
      notify(cause instanceof Error ? cause.message : t("common.error"), "error");
    }
  };

  const rows = [
    {
      key: "web",
      title: t("perm.web"),
      status: t("perm.webStatus"),
      tone: "ok",
      note: "Modes, rules, proposals, timeline, notifications — all local, no account.",
    },
    {
      key: "bridge",
      title: t("perm.bridge"),
      status: bridgeConnected
        ? t("perm.bridgeConnected")
        : caps.bridge.available
          ? t("perm.bridgeOff")
          : t("perm.bridgeUnavailable"),
      tone: bridgeConnected ? "ok" : caps.bridge.available ? "warn" : "muted",
      note: caps.bridge.note,
    },
    {
      key: "ax",
      title: t("perm.ax"),
      status: !isMac
        ? t("perm.notApplicable")
        : caps.accessibility.status === "granted"
          ? "granted"
          : caps.accessibility.status === "denied"
            ? t("perm.axDenied")
            : caps.bridge.available
              ? t("perm.bridgeOff")
              : t("perm.bridgeUnavailable"),
      tone: !isMac ? "muted" : caps.accessibility.status === "granted" ? "ok" : "muted",
      note: caps.accessibility.note,
    },
    {
      key: "notifications",
      title: t("perm.notifications"),
      status: t("perm.notificationsStatus"),
      tone: "blocked",
      note: t("perm.notificationsTruth"),
    },
    {
      key: "cloud",
      title: t("perm.cloud"),
      status:
        caps.cloud_ai.opt_in && caps.cloud_ai.provider !== "rules"
          ? t("perm.cloudOn")
          : t("perm.cloudOff"),
      tone: caps.cloud_ai.opt_in ? "warn" : "muted",
      note: "Cloud proposals are opt-in. Activity contents are never included unless you enable it in Settings.",
    },
  ];

  return (
    <div className="view">
      <header className="view-head">
        <div>
          <span className="eyebrow">Honest boundaries</span>
          <h1>{t("perm.title")}</h1>
          <p>{t("perm.subtitle")}</p>
        </div>
      </header>

      <section className="panel cap-panel">
        <div className="cap-table" role="table" aria-label={t("perm.title")}>
          <div className="cap-row cap-head" role="row">
            <span role="columnheader">{t("perm.capability")}</span>
            <span role="columnheader">{t("perm.status")}</span>
          </div>
          {rows.map((row) => (
            <div className="cap-row" role="row" key={row.key}>
              <div className="cap-name" role="cell">
                <strong>{row.title}</strong>
                <span>{row.note}</span>
              </div>
              <div role="cell">
                <span className={`cap-status tone-${row.tone}`}>{row.status}</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      <div className="grid-2">
        <section className="panel">
          <header className="panel-head">
            <div>
              <span className="eyebrow">Loopback only</span>
              <h2>Bridge authentication</h2>
            </div>
            <span className={`badge ${bridgeConnected ? "badge-live" : ""}`}>
              {bridgeConnected ? t("misc.connected") : t("misc.offline")}
            </span>
          </header>
          <p className="panel-note">
            The native companion authenticates with a scoped token that rotates every server run.
            The token is never exposed to the browser or placed in a URL.
          </p>
          <p className="panel-note">
            {t("perm.tokenPath")}: <code>{state.bridge.token_path}</code>
          </p>
          <div className="panel-actions">
            <button className="btn btn-ghost" type="button" onClick={() => void rotate()}>
              {t("perm.rotate")}
            </button>
          </div>
        </section>

        <section className="panel">
          <header className="panel-head">
            <div>
              <span className="eyebrow">Invariants</span>
              <h2>What this app will never do</h2>
            </div>
          </header>
          <ul className="truth-list">
            <li>No `killall Dock`, no writes to `com.apple.dock`, no SIP changes.</li>
            <li>No private APIs, no injection into other apps, no Notification Center database reads.</li>
            <li>No keystroke, clipboard, screen, or browser-history capture.</li>
            <li>No model-generated shell, AppleScript, or network actions.</li>
            <li>No cloud calls without an explicit opt-in and a configured key.</li>
          </ul>
        </section>
      </div>
    </div>
  );
}
