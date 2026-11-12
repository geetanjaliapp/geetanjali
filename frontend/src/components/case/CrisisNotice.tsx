// scripts/synthetic/check.mjs also reads crisis-notice.json: move or rename it in both places.
import crisisNotice from "../../content/crisis-notice.json";

interface CrisisNoticeProps {
  id: string;
  className?: string;
}

export function CrisisNotice({ id, className = "" }: CrisisNoticeProps) {
  return (
    <p id={id} className={`text-sm text-[var(--text-secondary)] ${className}`}>
      {crisisNotice.text}
    </p>
  );
}
