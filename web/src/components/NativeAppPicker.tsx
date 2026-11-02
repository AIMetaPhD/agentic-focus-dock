import { useEffect, useMemo, useState } from "react";
import { api } from "../api";
import { useT } from "../i18n";
import { NativeAppIcon } from "./NativeAppIcon";

export type NativeApp = { id: string; name: string };

export function NativeAppPicker({
  open,
  onClose,
  onPin,
  onLaunch,
}: {
  open: boolean;
  onClose: () => void;
  onPin: (app: NativeApp) => void;
  onLaunch: (app: NativeApp) => void;
}) {
  const { t } = useT();
  const [apps, setApps] = useState<NativeApp[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setQuery("");
    setLoading(true);
    setError(null);
    void api<{ apps: NativeApp[] }>("/api/native/apps")
      .then((data) => setApps(Array.isArray(data.apps) ? data.apps : []))
      .catch((cause) =>
        setError(cause instanceof Error ? cause.message : t("misc.nativeUnavailable")),
      )
      .finally(() => setLoading(false));
  }, [open, t]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return apps;
    return apps.filter((app) => app.name.toLowerCase().includes(q));
  }, [apps, query]);

  if (!open) return null;

  return (
    <div className="native-modal" role="dialog" aria-modal="true" aria-label={t("native.addTitle")}>
      <div className="native-modal-card">
        <header>
          <div>
            <span className="eyebrow">Windows companion</span>
            <h2>{t("native.addTitle")}</h2>
          </div>
          <button className="icon-btn" type="button" onClick={onClose} aria-label={t("common.close")}>
            ×
          </button>
        </header>
        <p className="panel-note">{t("native.addIntro")}</p>
        <input
          className="native-search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={t("native.search")}
          aria-label={t("native.search")}
        />
        {loading ? <p className="empty">{t("native.loading")}</p> : null}
        {error ? <p className="empty">{error}</p> : null}
        {!loading && !error ? (
          <div className="native-app-list">
            {filtered.length === 0 ? (
              <p className="empty">{t("native.noMatches")}</p>
            ) : (
              filtered.map((app) => (
                <div className="native-app-row" key={app.id}>
                  <NativeAppIcon id={app.id} label={app.name} />
                  <span className="native-app-name">{app.name}</span>
                  <button className="btn btn-ghost" type="button" onClick={() => onLaunch(app)}>
                    {t("native.testLaunch")}
                  </button>
                  <button className="btn btn-primary" type="button" onClick={() => onPin(app)}>
                    {t("native.pin")}
                  </button>
                </div>
              ))
            )}
          </div>
        ) : null}
        <p className="panel-note native-diagnostic-note">{t("native.diagnosticNote")}</p>
      </div>
    </div>
  );
}
