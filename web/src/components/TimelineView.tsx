import { useEffect, useState } from "react";
import { api } from "../api";
import { useT, type TranslationKey } from "../i18n";
import type { ActivityEvent, AppState } from "../types";

type Filter = "all" | "activity" | "notification";

export function TimelineView({ state }: { state: AppState }) {
  const { t, lang } = useT();
  const [filter, setFilter] = useState<Filter>("all");
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const query = filter === "all" ? "" : `&kind=${filter}`;
    void api<ActivityEvent[]>(`/api/events?limit=200${query}`)
      .then((rows) => {
        if (!cancelled) setEvents(rows);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [filter, state.counts.events]);

  return (
    <div className="view">
      <header className="view-head">
        <div>
          <span className="eyebrow">Audit trail</span>
          <h1>{t("timeline.title")}</h1>
          <p>{t("timeline.subtitle")}</p>
        </div>
        <div className="segmented" role="tablist" aria-label={t("timeline.title")}>
          {(["all", "activity", "notification"] as Filter[]).map((value) => (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={filter === value}
              className={filter === value ? "is-active" : ""}
              onClick={() => setFilter(value)}
            >
              {t(value === "all" ? "timeline.all" : value === "activity" ? "timeline.activity" : "timeline.notification")}
            </button>
          ))}
        </div>
      </header>

      {loading ? <p className="empty">{t("common.loading")}</p> : null}
      {!loading && events.length === 0 ? <p className="empty">{t("timeline.empty")}</p> : null}

      <ol className="timeline">
        {events.map((event) => {
          const sourceKey = `source.${event.source}` as TranslationKey;
          const urgent = event.classification.decision === "time_sensitive";
          return (
            <li key={event.id} className={`timeline-item ${urgent ? "is-urgent" : ""}`}>
              <div className="timeline-rail" aria-hidden="true">
                <span className={`rail-dot source-${event.source}`} />
              </div>
              <div className="timeline-card">
                <header className="timeline-top">
                  <div className="timeline-title">
                    <span className={`kind kind-${event.kind}`}>
                      {event.kind === "notification" ? "notification" : "activity"}
                    </span>
                    <strong>
                      {event.kind === "notification"
                        ? event.payload.title ?? "Notification"
                        : event.payload.app_name ?? event.source_app}
                    </strong>
                    <span className={`badge source-badge source-${event.source}`}>{t(sourceKey)}</span>
                  </div>
                  <time dateTime={event.timestamp}>
                    {new Date(event.timestamp).toLocaleTimeString(lang === "zh" ? "zh-CN" : "en-GB", {
                      hour: "2-digit",
                      minute: "2-digit",
                      second: "2-digit",
                    })}
                  </time>
                </header>

                {event.payload.body ? <p className="timeline-body">{event.payload.body}</p> : null}

                <dl className="timeline-facts">
                  <div>
                    <dt>{t("timeline.decision")}</dt>
                    <dd>
                      <span className={`decision decision-${event.classification.decision}`}>
                        {event.classification.decision}
                      </span>
                    </dd>
                  </div>
                  <div>
                    <dt>{t("timeline.reason")}</dt>
                    <dd>{event.classification.reason}</dd>
                  </div>
                  <div>
                    <dt>{t("timeline.confidence")}</dt>
                    <dd>
                      <span className="confidence">
                        <span style={{ width: `${Math.round(event.classification.confidence * 100)}%` }} />
                      </span>
                      {Math.round(event.classification.confidence * 100)}%
                    </dd>
                  </div>
                  <div>
                    <dt>{t("timeline.action")}</dt>
                    <dd>
                      <code>{event.actual_action}</code>
                    </dd>
                  </div>
                  <div>
                    <dt>{t("timeline.engine")}</dt>
                    <dd>{event.classification.engine}</dd>
                  </div>
                </dl>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
