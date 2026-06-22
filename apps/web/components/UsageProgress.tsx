import { usageProgressSeverity, type UsageProgressView } from "../../../packages/view-model/src/usage-progress";

export function UsageProgress({
  label,
  progress,
  compact = false,
}: {
  label: string;
  progress: UsageProgressView;
  compact?: boolean;
}) {
  const usedPercent = progress.usedPercent;
  const severity = usageProgressSeverity(progress);
  const rounded = usedPercent === null ? null : Math.round(usedPercent);

  return (
    <span
      aria-label={label}
      aria-valuemax={100}
      aria-valuemin={0}
      aria-valuenow={rounded ?? undefined}
      aria-valuetext={rounded === null ? "unknown" : `${rounded}% used`}
      className={compact ? "usage-progress usage-progress-compact" : "usage-progress"}
      role="progressbar"
    >
      <span className="progress-track" aria-hidden="true">
        <span
          className={severity === "critical"
            ? "progress-bar progress-bar-critical"
            : severity === "warning"
              ? "progress-bar progress-bar-warn"
              : "progress-bar"}
          style={{ width: `${rounded ?? 0}%` }}
        />
      </span>
    </span>
  );
}
