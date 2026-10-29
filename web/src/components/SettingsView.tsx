import { useEffect, useRef, useState } from "react";
import { api, downloadJson } from "../api";
import { useT } from "../i18n";
import type { AppState, Settings } from "../types";

export function SettingsView({
  state,
  onChanged,
  notify,
}: {
  state: AppState;
  onChanged: () => Promise<void>;
  notify: (message: string, kind?: "ok" | "error") => void;
}) {
  const { t } = useT();
  const [ai, setAi] = useState(state.settings.ai);
  const [privacy, setPrivacy] = useState(state.settings.privacy);
  const [apiKey, setApiKey] = useState("");
  const [busy, setBusy] = useState(false);
  const [excluded, setExcluded] = useState(state.settings.privacy.excluded_apps.join(", "));
  const importInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setAi(state.settings.ai);
    setPrivacy(state.settings.privacy);
    setExcluded(state.settings.privacy.excluded_apps.join(", "));
  }, [state.settings]);

  const save = async (patch: Partial<Settings>) => {
    setBusy(true);
    try {
      await api<Settings>("/api/settings", { method: "PUT", body: patch });
      await onChanged();
      notify(t("settings.saved"));
    } catch (cause) {
      notify(cause instanceof Error ? cause.message : t("common.error"), "error");
    } finally {
      setBusy(false);
    }
  };

  const saveAi = () =>
    save({
      ai: {
        provider: ai.provider,
        ollama_url: ai.ollama_url,
        ollama_model: ai.ollama_model,
        base_url: ai.base_url,
        model: ai.model,
        cloud_opt_in: ai.cloud_opt_in,
        include_recent_activity: ai.include_recent_activity,
      },
    });

  const savePrivacy = () =>
    save({
      privacy: {
        retention_days: privacy.retention_days,
        store_window_titles: privacy.store_window_titles,
        excluded_apps: excluded
          .split(",")
          .map((value) => value.trim())
          .filter(Boolean),
      },
    });

  const saveKey = async (value: string | null) => {
    setBusy(true);
    try {
      await api("/api/settings/ai-key", { method: "PUT", body: { api_key: value } });
      setApiKey("");
      await onChanged();
      notify(value ? t("settings.keySaved") : t("common.saved"));
    } catch (cause) {
      notify(cause instanceof Error ? cause.message : t("common.error"), "error");
    } finally {
      setBusy(false);
    }
  };

  const exportModes = async () => {
    const data = await api("/api/export");
    downloadJson("focusdock-modes.json", data);
  };

  const importModes = async (file: File) => {
    try {
      const parsed = JSON.parse(await file.text()) as unknown;
      await api("/api/import", { method: "POST", body: parsed });
      await onChanged();
      notify(t("common.saved"));
    } catch (cause) {
      notify(cause instanceof Error ? cause.message : t("common.error"), "error");
    }
  };

  const clearEvents = async () => {
    if (!window.confirm(`${t("settings.clearEvents")}?`)) return;
    await api("/api/data/clear-events", { method: "POST", body: { confirm: true } });
    await onChanged();
    notify(t("common.saved"));
  };

  const resetAll = async () => {
    const answer = window.prompt(t("settings.resetConfirm"));
    if (answer !== "RESET") return;
    await api("/api/data/reset", { method: "POST", body: { confirm: "RESET" } });
    await onChanged();
    notify(t("common.saved"));
  };

  return (
    <div className="view">
      <header className="view-head">
        <div>
          <span className="eyebrow">Local-first</span>
          <h1>{t("settings.title")}</h1>
          <p>{t("settings.subtitle")}</p>
        </div>
      </header>

      <div className="settings-grid">
        <section className="panel">
          <header className="panel-head">
            <div>
              <span className="eyebrow">Interface</span>
              <h2>{t("settings.language")}</h2>
            </div>
          </header>
          <div className="segmented">
            <button
              type="button"
              className={state.settings.language === "en" ? "is-active" : ""}
              onClick={() => void save({ language: "en" })}
            >
              English
            </button>
            <button
              type="button"
              className={state.settings.language === "zh" ? "is-active" : ""}
              onClick={() => void save({ language: "zh" })}
            >
              简体中文
            </button>
          </div>
          <p className="panel-note">
            {t("settings.dataDir")}: <code>{state.settings.data_dir ?? "—"}</code>
          </p>
        </section>

        <section className="panel">
          <header className="panel-head">
            <div>
              <span className="eyebrow">Decision layer</span>
              <h2>{t("settings.ai")}</h2>
            </div>
            <span className={`badge ${ai.provider === "rules" ? "" : "badge-live"}`}>{ai.provider}</span>
          </header>

          <label className="field">
            <span>{t("settings.provider")}</span>
            <select
              value={ai.provider}
              onChange={(event) =>
                setAi({ ...ai, provider: event.target.value as Settings["ai"]["provider"] })
              }
            >
              <option value="rules">{t("settings.rules")}</option>
              <option value="ollama">{t("settings.ollama")}</option>
              <option value="openai-compatible">{t("settings.openai")}</option>
            </select>
          </label>

          {ai.provider === "ollama" ? (
            <div className="form-grid">
              <label className="field">
                <span>{t("settings.ollamaUrl")}</span>
                <input value={ai.ollama_url} onChange={(event) => setAi({ ...ai, ollama_url: event.target.value })} />
              </label>
              <label className="field">
                <span>{t("settings.ollamaModel")}</span>
                <input
                  value={ai.ollama_model}
                  onChange={(event) => setAi({ ...ai, ollama_model: event.target.value })}
                />
              </label>
            </div>
          ) : null}

          {ai.provider === "openai-compatible" ? (
            <>
              <div className="form-grid">
                <label className="field">
                  <span>{t("settings.baseUrl")}</span>
                  <input value={ai.base_url} onChange={(event) => setAi({ ...ai, base_url: event.target.value })} />
                </label>
                <label className="field">
                  <span>{t("settings.model")}</span>
                  <input value={ai.model} onChange={(event) => setAi({ ...ai, model: event.target.value })} />
                </label>
              </div>
              <label className="check">
                <input
                  type="checkbox"
                  checked={ai.cloud_opt_in}
                  onChange={(event) => setAi({ ...ai, cloud_opt_in: event.target.checked })}
                />
                <span>{t("settings.cloudOptIn")}</span>
              </label>
              <label className="check">
                <input
                  type="checkbox"
                  checked={ai.include_recent_activity}
                  onChange={(event) => setAi({ ...ai, include_recent_activity: event.target.checked })}
                />
                <span>{t("settings.includeActivity")}</span>
              </label>

              <label className="field">
                <span>
                  {t("settings.apiKey")} {ai.has_api_key ? "✓" : ""}
                </span>
                <input
                  type="password"
                  autoComplete="off"
                  value={apiKey}
                  placeholder={ai.has_api_key ? "••••••••" : ""}
                  onChange={(event) => setApiKey(event.target.value)}
                />
              </label>
              <p className="panel-note">{t("settings.apiKeyHint")}</p>
              <div className="head-actions">
                <button
                  className="btn btn-ghost"
                  type="button"
                  disabled={busy || apiKey.length < 8}
                  onClick={() => void saveKey(apiKey)}
                >
                  {t("settings.saveKey")}
                </button>
                <button
                  className="btn btn-ghost"
                  type="button"
                  disabled={busy || !ai.has_api_key}
                  onClick={() => void saveKey(null)}
                >
                  {t("settings.clearKey")}
                </button>
              </div>
            </>
          ) : null}

          <div className="panel-actions">
            <button className="btn btn-primary" type="button" disabled={busy} onClick={() => void saveAi()}>
              {t("common.save")}
            </button>
          </div>
        </section>

        <section className="panel">
          <header className="panel-head">
            <div>
              <span className="eyebrow">Data minimisation</span>
              <h2>{t("settings.privacy")}</h2>
            </div>
          </header>
          <div className="form-grid">
            <label className="field">
              <span>{t("settings.retention")}</span>
              <input
                type="number"
                min={1}
                max={365}
                value={privacy.retention_days}
                onChange={(event) =>
                  setPrivacy({ ...privacy, retention_days: Number(event.target.value) })
                }
              />
            </label>
            <label className="check">
              <input
                type="checkbox"
                checked={privacy.store_window_titles}
                onChange={(event) =>
                  setPrivacy({ ...privacy, store_window_titles: event.target.checked })
                }
              />
              <span>{t("settings.storeTitles")}</span>
            </label>
          </div>
          <label className="field field-full">
            <span>{t("settings.excluded")}</span>
            <input value={excluded} onChange={(event) => setExcluded(event.target.value)} />
          </label>
          <div className="panel-actions">
            <button className="btn btn-primary" type="button" disabled={busy} onClick={() => void savePrivacy()}>
              {t("common.save")}
            </button>
          </div>
        </section>

        <section className="panel">
          <header className="panel-head">
            <div>
              <span className="eyebrow">You own it</span>
              <h2>{t("settings.data")}</h2>
            </div>
          </header>
          <div className="data-actions">
            <button className="btn btn-ghost" type="button" onClick={() => void exportModes()}>
              {t("settings.export")}
            </button>
            <button className="btn btn-ghost" type="button" onClick={() => importInput.current?.click()}>
              {t("settings.import")}
            </button>
            <input
              ref={importInput}
              type="file"
              accept="application/json"
              hidden
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void importModes(file);
                event.target.value = "";
              }}
            />
            <button className="btn btn-ghost" type="button" onClick={() => void clearEvents()}>
              {t("settings.clearEvents")}
            </button>
            <button className="btn btn-danger" type="button" onClick={() => void resetAll()}>
              {t("settings.reset")}
            </button>
          </div>
          <p className="panel-note">{t("perm.truth")}</p>
        </section>
      </div>
    </div>
  );
}
