import { useEffect, useState } from "react";
import { api } from "../api";
import { useT } from "../i18n";
import type { AppState, Proposal } from "../types";

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return JSON.stringify(value, null, 2);
}

function statusLabel(status: Proposal["status"], t: ReturnType<typeof useT>["t"]): string {
  if (status === "applied") return t("ai.applied");
  if (status === "rejected") return t("ai.rejected");
  if (status === "failed") return t("ai.failed");
  return t("ai.proposed");
}

export function AIStudio({
  state,
  onChanged,
  notify,
}: {
  state: AppState;
  onChanged: () => Promise<void>;
  notify: (message: string, kind?: "ok" | "error") => void;
}) {
  const { t } = useT();
  const [prompt, setPrompt] = useState("");
  const [busy, setBusy] = useState(false);
  const [current, setCurrent] = useState<Proposal | null>(null);
  const [history, setHistory] = useState<Proposal[]>([]);
  const [error, setError] = useState<string | null>(null);

  const loadHistory = async () => {
    try {
      setHistory(await api<Proposal[]>("/api/proposals"));
    } catch {
      setHistory([]);
    }
  };

  useEffect(() => {
    void loadHistory();
  }, []);

  const generate = async () => {
    if (prompt.trim().length < 3) return;
    setBusy(true);
    setError(null);
    try {
      const proposal = await api<Proposal>("/api/proposals", { method: "POST", body: { prompt } });
      setCurrent(proposal);
      await loadHistory();
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : t("common.error");
      setError(message);
    } finally {
      setBusy(false);
    }
  };

  const apply = async () => {
    if (!current) return;
    setBusy(true);
    try {
      const result = await api<{ proposal: Proposal }>(`/api/proposals/${current.id}/apply`, {
        method: "POST",
      });
      setCurrent(result.proposal);
      await Promise.all([onChanged(), loadHistory()]);
      notify(t("ai.applied"));
    } catch (cause) {
      notify(cause instanceof Error ? cause.message : t("common.error"), "error");
    } finally {
      setBusy(false);
    }
  };

  const reject = async () => {
    if (!current) return;
    setBusy(true);
    try {
      const proposal = await api<Proposal>(`/api/proposals/${current.id}/reject`, { method: "POST" });
      setCurrent(proposal);
      await loadHistory();
    } catch (cause) {
      notify(cause instanceof Error ? cause.message : t("common.error"), "error");
    } finally {
      setBusy(false);
    }
  };

  const examples = [t("ai.example1"), t("ai.example2"), t("ai.example3"), t("ai.example4")];

  return (
    <div className="view">
      <header className="view-head">
        <div>
          <span className="eyebrow">Constrained agent</span>
          <h1>{t("ai.title")}</h1>
          <p>{t("ai.subtitle")}</p>
        </div>
        <div className={`engine-chip provider-${state.settings.ai.provider}`}>
          <span className="engine-dot" aria-hidden="true" />
          {state.settings.ai.provider === "rules" ? t("ai.rulesOnly") : state.settings.ai.provider}
        </div>
      </header>

      <div className="ai-layout">
        <section className="panel composer">
          <label className="field field-full">
            <span>{t("ai.prompt")}</span>
            <textarea
              rows={4}
              value={prompt}
              maxLength={2000}
              placeholder={t("ai.placeholder")}
              onChange={(event) => setPrompt(event.target.value)}
            />
          </label>
          <div className="composer-foot">
            <span className="char-count">{prompt.length} / 2000</span>
            <button
              className="btn btn-primary"
              type="button"
              disabled={busy || prompt.trim().length < 3}
              onClick={generate}
            >
              {busy ? t("ai.generating") : t("ai.generate")}
            </button>
          </div>
          {error ? <p className="form-error">{error}</p> : null}
          <div className="examples">
            <span className="eyebrow">{t("ai.examples")}</span>
            {examples.map((example) => (
              <button key={example} className="example-chip" type="button" onClick={() => setPrompt(example)}>
                {example}
              </button>
            ))}
          </div>
          {state.settings.ai.provider === "rules" ? (
            <p className="panel-note">{t("ai.noModel")}</p>
          ) : null}
        </section>

        <section className="panel proposal-panel">
          {!current ? (
            <p className="empty">{t("ai.empty")}</p>
          ) : (
            <>
              <header className="panel-head">
                <div>
                  <span className="eyebrow">{t("ai.summary")}</span>
                  <h2>{current.summary}</h2>
                </div>
                <span className={`status-pill status-${current.status}`}>
                  {statusLabel(current.status, t)}
                </span>
              </header>

              <div className="proposal-meta">
                <span className="badge">{current.source}</span>
                {current.latency_ms !== null && current.latency_ms !== undefined ? (
                  <span className="muted">{t("ai.latency", { ms: current.latency_ms })}</span>
                ) : null}
                <code>{current.id}</code>
              </div>

              {current.fallback_reason ? (
                <p className="fallback-note">{t("ai.fallback", { reason: current.fallback_reason })}</p>
              ) : null}
              {current.error ? <p className="form-error">{current.error}</p> : null}

              <div className="diff-list">
                {current.diff.map((entry, index) => (
                  <div className="diff-entry" key={`${entry.path}-${index}`}>
                    <div className="diff-head">
                      <span className={`op op-${entry.op}`}>{entry.op}</span>
                      <code>{entry.path}</code>
                    </div>
                    <div className="diff-body">
                      {entry.op !== "add" ? (
                        <pre className="diff-before">{formatValue(entry.before)}</pre>
                      ) : null}
                      {entry.op !== "remove" ? (
                        <pre className="diff-after">{formatValue(entry.after)}</pre>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>

              {current.status === "proposed" ? (
                <div className="proposal-actions">
                  <button className="btn btn-ghost" type="button" disabled={busy} onClick={reject}>
                    {t("common.reject")}
                  </button>
                  <button className="btn btn-primary" type="button" disabled={busy} onClick={apply}>
                    {t("common.apply")}
                  </button>
                </div>
              ) : null}
            </>
          )}
        </section>
      </div>

      <section className="panel">
        <header className="panel-head">
          <div>
            <span className="eyebrow">Audit</span>
            <h2>{t("ai.history")}</h2>
          </div>
        </header>
        {history.length === 0 ? <p className="empty">{t("ai.empty")}</p> : null}
        <ul className="proposal-history">
          {history.map((proposal) => (
            <li key={proposal.id}>
              <button type="button" onClick={() => setCurrent(proposal)}>
                <span className={`status-dot status-${proposal.status}`} aria-hidden="true" />
                <span className="history-summary">{proposal.summary}</span>
                <span className="history-meta">
                  {proposal.source} · {new Date(proposal.created_at).toLocaleString()}
                </span>
                <span className={`status-pill status-${proposal.status}`}>
                  {statusLabel(proposal.status, t)}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
