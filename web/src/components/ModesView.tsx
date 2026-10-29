import { useEffect, useMemo, useRef, useState } from "react";
import { api, downloadJson } from "../api";
import { useT } from "../i18n";
import type { AppState, Mode, ModeColor, ModeConfig, ModeVersion, PinnedItem } from "../types";

const COLORS: ModeColor[] = ["amber", "blue", "violet", "teal", "rose", "pink", "lime", "slate"];

type Draft = ModeConfig;

function draftFrom(mode: Mode): Draft {
  return {
    name: mode.name,
    color: mode.color,
    icon: mode.icon,
    pinned_items: mode.pinned_items.map((p) => ({ ...p })),
    activity_app_allowlist: [...mode.activity_app_allowlist],
    keywords: [...mode.keywords],
    transition: { ...mode.transition },
    notifications: { ...mode.notifications },
    sort_order: mode.sort_order,
  };
}

function blankDraft(index: number): Draft {
  return {
    name: "",
    color: "slate",
    icon: "◎",
    pinned_items: [],
    activity_app_allowlist: [],
    keywords: [],
    transition: {
      manual_immediate: true,
      auto_suggest_only: true,
      dwell_seconds: 15,
      cooldown_seconds: 60,
    },
    notifications: {
      default: "defer",
      time_sensitive: "show",
      switch_wait_seconds: 30,
      social_switch_enabled: true,
    },
    sort_order: index,
  };
}

function splitList(value: string): string[] {
  return value
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
}

export function ModesView({
  state,
  onChanged,
  notify,
}: {
  state: AppState;
  onChanged: () => Promise<void>;
  notify: (message: string, kind?: "ok" | "error") => void;
}) {
  const { t } = useT();
  const [selectedId, setSelectedId] = useState<string | null>(state.modes[0]?.id ?? null);
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [keywords, setKeywords] = useState("");
  const [allowlist, setAllowlist] = useState("");
  const [versions, setVersions] = useState<ModeVersion[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const selected = useMemo(
    () => state.modes.find((m) => m.id === selectedId) ?? null,
    [state.modes, selectedId],
  );

  const selectedIdSafe = selected?.id ?? null;
  const selectedVersion = selected?.version ?? null;

  useEffect(() => {
    if (creating) return;
    if (!selectedIdSafe) {
      setDraft(null);
      setVersions([]);
      return;
    }
    const mode = state.modes.find((m) => m.id === selectedIdSafe);
    if (!mode) return;
    setDraft(draftFrom(mode));
    setKeywords(mode.keywords.join(", "));
    setAllowlist(mode.activity_app_allowlist.join(", "));
    setError(null);
    void api<ModeVersion[]>(`/api/modes/${mode.id}/versions`)
      .then(setVersions)
      .catch(() => setVersions([]));
    // Re-hydrate only when the selected mode or its stored version changes.
  }, [selectedIdSafe, selectedVersion, creating]);

  const startNew = () => {
    setCreating(true);
    setSelectedId(null);
    setDraft(blankDraft(state.modes.length));
    setKeywords("");
    setAllowlist("");
    setVersions([]);
    setError(null);
  };

  const select = (id: string) => {
    setCreating(false);
    setSelectedId(id);
  };

  const update = (patch: Partial<Draft>) => {
    setDraft((current) => (current ? { ...current, ...patch } : current));
  };

  const updatePinned = (index: number, patch: Partial<PinnedItem>) => {
    setDraft((current) => {
      if (!current) return current;
      const pinned = current.pinned_items.map((item, i) => (i === index ? { ...item, ...patch } : item));
      return { ...current, pinned_items: pinned };
    });
  };

  const addPinned = () => {
    setDraft((current) => {
      if (!current) return current;
      const item: PinnedItem = {
        id: `pin-${Date.now().toString(36)}`,
        label: "",
        icon: "◎",
        kind: "app",
      };
      return { ...current, pinned_items: [...current.pinned_items, item] };
    });
  };

  const removePinned = (index: number) => {
    setDraft((current) => {
      if (!current) return current;
      return { ...current, pinned_items: current.pinned_items.filter((_, i) => i !== index) };
    });
  };

  const normalizePinned = (items: PinnedItem[]): PinnedItem[] =>
    items
      .filter((item) => item.label.trim())
      .map((item, index) => {
        const target = (item.bundle_id ?? item.url ?? "").trim();
        const isUrl = /^https?:\/\//.test(target);
        return {
          id: item.id || `pin-${index}`,
          label: item.label.trim().slice(0, 80),
          icon: (item.icon || "◎").slice(0, 8),
          kind: isUrl ? "bookmark" : "app",
          ...(isUrl ? { url: target } : { bundle_id: target }),
        };
      });

  const save = async () => {
    if (!draft) return;
    if (!draft.name.trim()) {
      setError(t("modes.name"));
      return;
    }
    setSaving(true);
    setError(null);
    const payload: Draft = {
      ...draft,
      name: draft.name.trim(),
      keywords: splitList(keywords),
      activity_app_allowlist: splitList(allowlist),
      pinned_items: normalizePinned(draft.pinned_items),
    };
    try {
      if (creating) {
        const created = await api<Mode>("/api/modes", { method: "POST", body: payload });
        setCreating(false);
        setSelectedId(created.id);
      } else if (selected) {
        await api<Mode>(`/api/modes/${selected.id}`, { method: "PUT", body: payload });
      }
      await onChanged();
      notify(t("common.saved"));
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : t("common.error");
      setError(message);
      notify(message, "error");
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!selected) return;
    if (!window.confirm(t("modes.deleteConfirm", { name: selected.name }))) return;
    try {
      await api(`/api/modes/${selected.id}`, { method: "DELETE" });
      setSelectedId(state.modes.find((m) => m.id !== selected.id)?.id ?? null);
      await onChanged();
    } catch (cause) {
      notify(cause instanceof Error ? cause.message : t("common.error"), "error");
    }
  };

  const move = async (direction: -1 | 1) => {
    if (!selected) return;
    const ids = state.modes.map((m) => m.id);
    const index = ids.indexOf(selected.id);
    const next = index + direction;
    if (index < 0 || next < 0 || next >= ids.length) return;
    const a = ids[index];
    const b = ids[next];
    if (!a || !b) return;
    ids[index] = b;
    ids[next] = a;
    await api("/api/modes/reorder", { method: "POST", body: { ids } });
    await onChanged();
  };

  const rollback = async (version: number) => {
    if (!selected) return;
    if (!window.confirm(`${t("modes.rollback")} v${version}?`)) return;
    await api(`/api/modes/${selected.id}/rollback`, { method: "POST", body: { version } });
    await onChanged();
    notify(t("common.saved"));
  };

  const exportModes = async () => {
    const data = await api("/api/export");
    downloadJson("focusdock-modes.json", data);
  };

  const importModes = async (file: File) => {
    try {
      const text = await file.text();
      const parsed = JSON.parse(text) as unknown;
      await api("/api/import", { method: "POST", body: parsed });
      await onChanged();
      notify(t("common.saved"));
    } catch (cause) {
      notify(cause instanceof Error ? cause.message : t("common.error"), "error");
    }
  };

  const restoreDefaults = async () => {
    await api("/api/modes/restore-defaults", { method: "POST" });
    await onChanged();
    notify(t("common.saved"));
  };

  return (
    <div className="view">
      <header className="view-head">
        <div>
          <span className="eyebrow">Declarative</span>
          <h1>{t("modes.title")}</h1>
          <p>{t("modes.subtitle")}</p>
        </div>
        <div className="head-actions">
          <button className="btn btn-ghost" type="button" onClick={exportModes}>
            {t("modes.export")}
          </button>
          <button className="btn btn-ghost" type="button" onClick={() => fileInput.current?.click()}>
            {t("modes.import")}
          </button>
          <input
            ref={fileInput}
            type="file"
            accept="application/json"
            hidden
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void importModes(file);
              event.target.value = "";
            }}
          />
          <button className="btn btn-primary" type="button" onClick={startNew}>
            + {t("modes.new")}
          </button>
        </div>
      </header>

      <div className="modes-layout">
        <aside className="mode-list" aria-label={t("modes.title")}>
          {state.modes.map((mode, index) => (
            <button
              key={mode.id}
              type="button"
              className={`mode-list-item mode-${mode.color} ${
                selectedId === mode.id && !creating ? "is-active" : ""
              }`}
              onClick={() => select(mode.id)}
            >
              <span className="mode-list-glyph" aria-hidden="true">
                {mode.icon}
              </span>
              <span className="mode-list-copy">
                <strong>{mode.name}</strong>
                <span>
                  {mode.is_builtin ? t("modes.builtin") : t("modes.custom")} ·{" "}
                  {t("modes.version", { version: mode.version })}
                </span>
              </span>
              <span className="mode-list-index">{String(index + 1).padStart(2, "0")}</span>
            </button>
          ))}
          {creating ? (
            <div className="mode-list-item is-active is-new">
              <span className="mode-list-glyph">◎</span>
              <span className="mode-list-copy">
                <strong>{t("modes.new")}</strong>
                <span>{t("modes.custom")}</span>
              </span>
            </div>
          ) : null}
          <button className="text-btn restore-link" type="button" onClick={restoreDefaults}>
            {t("modes.restoreDefaults")}
          </button>
        </aside>

        <section className="mode-editor panel">
          {!draft ? (
            <p className="empty">{t("common.none")}</p>
          ) : (
            <>
              <header className="panel-head">
                <div>
                  <span className="eyebrow">{creating ? t("modes.new") : selected?.id}</span>
                  <h2>{draft.name || t("modes.name")}</h2>
                </div>
                <div className="head-actions">
                  {!creating && selected ? (
                    <>
                      <button className="icon-btn" type="button" title={t("modes.reorderUp")} onClick={() => move(-1)}>
                        ↑
                      </button>
                      <button className="icon-btn" type="button" title={t("modes.reorderDown")} onClick={() => move(1)}>
                        ↓
                      </button>
                      <button className="btn btn-danger" type="button" onClick={remove}>
                        {t("common.delete")}
                      </button>
                    </>
                  ) : null}
                  <button className="btn btn-primary" type="button" disabled={saving} onClick={save}>
                    {saving ? t("common.loading") : t("common.save")}
                  </button>
                </div>
              </header>

              {error ? <p className="form-error">{error}</p> : null}

              <div className="form-grid">
                <label className="field">
                  <span>{t("modes.name")}</span>
                  <input
                    value={draft.name}
                    maxLength={40}
                    onChange={(event) => update({ name: event.target.value })}
                  />
                </label>
                <label className="field field-small">
                  <span>{t("modes.icon")}</span>
                  <input
                    value={draft.icon}
                    maxLength={8}
                    onChange={(event) => update({ icon: event.target.value })}
                  />
                </label>

                <div className="field field-full">
                  <span>{t("modes.color")}</span>
                  <div className="swatches" role="radiogroup" aria-label={t("modes.color")}>
                    {COLORS.map((color) => (
                      <button
                        key={color}
                        type="button"
                        role="radio"
                        aria-checked={draft.color === color}
                        aria-label={color}
                        className={`swatch mode-${color} ${draft.color === color ? "is-active" : ""}`}
                        onClick={() => update({ color })}
                      />
                    ))}
                  </div>
                </div>

                <label className="field field-full">
                  <span>{t("modes.keywords")}</span>
                  <input value={keywords} onChange={(event) => setKeywords(event.target.value)} />
                </label>

                <label className="field field-full">
                  <span>{t("modes.allowlist")}</span>
                  <input value={allowlist} onChange={(event) => setAllowlist(event.target.value)} />
                </label>
              </div>

              <div className="subsection">
                <div className="subsection-head">
                  <h3>{t("modes.pinned")}</h3>
                  <button className="text-btn" type="button" onClick={addPinned}>
                    + {t("modes.addPinned")}
                  </button>
                </div>
                {draft.pinned_items.length === 0 ? <p className="empty">{t("common.none")}</p> : null}
                {draft.pinned_items.map((item, index) => (
                  <div className="pinned-row" key={item.id}>
                    <input
                      className="pin-icon"
                      value={item.icon}
                      maxLength={8}
                      aria-label={t("modes.icon")}
                      onChange={(event) => updatePinned(index, { icon: event.target.value })}
                    />
                    <input
                      value={item.label}
                      placeholder={t("modes.pinnedLabel")}
                      aria-label={t("modes.pinnedLabel")}
                      onChange={(event) => updatePinned(index, { label: event.target.value })}
                    />
                    <input
                      value={item.bundle_id ?? item.url ?? ""}
                      placeholder={t("modes.pinnedTarget")}
                      aria-label={t("modes.pinnedTarget")}
                      onChange={(event) => {
                        const value = event.target.value;
                        updatePinned(index, {
                          bundle_id: value,
                          url: undefined,
                        });
                      }}
                    />
                    <button
                      className="icon-btn"
                      type="button"
                      aria-label={t("common.delete")}
                      onClick={() => removePinned(index)}
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>

              <div className="form-grid">
                <label className="field">
                  <span>{t("modes.dwell")}</span>
                  <input
                    type="number"
                    min={0}
                    max={600}
                    value={draft.transition.dwell_seconds}
                    onChange={(event) =>
                      update({
                        transition: { ...draft.transition, dwell_seconds: Number(event.target.value) },
                      })
                    }
                  />
                </label>
                <label className="field">
                  <span>{t("modes.cooldown")}</span>
                  <input
                    type="number"
                    min={0}
                    max={3600}
                    value={draft.transition.cooldown_seconds}
                    onChange={(event) =>
                      update({
                        transition: { ...draft.transition, cooldown_seconds: Number(event.target.value) },
                      })
                    }
                  />
                </label>
                <label className="field">
                  <span>{t("modes.wait")}</span>
                  <input
                    type="number"
                    min={0}
                    max={300}
                    value={draft.notifications.switch_wait_seconds}
                    onChange={(event) =>
                      update({
                        notifications: {
                          ...draft.notifications,
                          switch_wait_seconds: Number(event.target.value),
                        },
                      })
                    }
                  />
                </label>
                <label className="field">
                  <span>{t("modes.policy")}</span>
                  <select
                    value={draft.notifications.default}
                    onChange={(event) =>
                      update({
                        notifications: {
                          ...draft.notifications,
                          default: event.target.value as Draft["notifications"]["default"],
                        },
                      })
                    }
                  >
                    <option value="show">{t("modes.policyShow")}</option>
                    <option value="defer">{t("modes.policyDefer")}</option>
                    <option value="ignore">{t("modes.policyIgnore")}</option>
                  </select>
                </label>
                <label className="check">
                  <input
                    type="checkbox"
                    checked={draft.transition.auto_suggest_only}
                    onChange={(event) =>
                      update({
                        transition: { ...draft.transition, auto_suggest_only: event.target.checked },
                      })
                    }
                  />
                  <span>{t("modes.autoSuggest")}</span>
                </label>
                <label className="check">
                  <input
                    type="checkbox"
                    checked={draft.notifications.social_switch_enabled}
                    onChange={(event) =>
                      update({
                        notifications: {
                          ...draft.notifications,
                          social_switch_enabled: event.target.checked,
                        },
                      })
                    }
                  />
                  <span>{t("modes.socialSwitch")}</span>
                </label>
              </div>

              {!creating && selected ? (
                <div className="subsection">
                  <div className="subsection-head">
                    <h3>{t("modes.versions")}</h3>
                  </div>
                  <ul className="version-list">
                    {versions.slice(0, 6).map((version) => (
                      <li key={version.id}>
                        <span className="version-tag">v{version.version}</span>
                        <span className="version-note">{version.note ?? version.source}</span>
                        <time dateTime={version.created_at}>
                          {new Date(version.created_at).toLocaleString()}
                        </time>
                        {version.version !== selected.version ? (
                          <button className="text-btn" type="button" onClick={() => rollback(version.version)}>
                            {t("modes.rollback")}
                          </button>
                        ) : (
                          <span className="version-current">current</span>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </>
          )}
        </section>
      </div>
    </div>
  );
}
