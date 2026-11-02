import { useEffect, useState } from "react";

export function NativeAppIcon({
  id,
  label,
  fallback = "▣",
  className,
}: {
  id?: string;
  label: string;
  fallback?: string;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [id]);

  if (!id || failed) {
    return (
      <span className={`native-app-glyph ${className ?? ""}`} title={label} aria-hidden="true">
        {fallback}
      </span>
    );
  }

  return (
    <img
      className={`native-app-icon ${className ?? ""}`}
      src={`/api/native/icon/${encodeURIComponent(id)}`}
      alt=""
      title={label}
      aria-hidden="true"
      onError={() => setFailed(true)}
    />
  );
}
