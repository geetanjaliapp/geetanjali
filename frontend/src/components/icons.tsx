/**
 * Shared icon components for consistent styling across the app.
 * All icons accept className for sizing and color customization.
 */

import { useId } from "react";

interface IconProps {
  className?: string;
}

export function CloseIcon({ className = "w-3 h-3" }: IconProps) {
  return (
    <svg
      className={className}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M6 18L18 6M6 6l12 12"
      />
    </svg>
  );
}

export function ChevronDownIcon({ className = "w-4 h-4" }: IconProps) {
  return (
    <svg
      className={className}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M19 9l-7 7-7-7"
      />
    </svg>
  );
}

export function StarIcon({ className = "w-3 h-3" }: IconProps) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 20 20">
      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
    </svg>
  );
}

export function ArrowUpIcon({ className = "w-5 h-5" }: IconProps) {
  return (
    <svg
      className={className}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M5 10l7-7m0 0l7 7m-7-7v18"
      />
    </svg>
  );
}

export function SpinnerIcon({ className = "w-4 h-4" }: IconProps) {
  return (
    <svg
      className={`animate-spin ${className}`}
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  );
}

export function SearchIcon({ className = "w-5 h-5" }: IconProps) {
  return (
    <svg
      className={className}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
      />
    </svg>
  );
}

interface HeartIconProps extends IconProps {
  filled?: boolean;
}

export function HeartIcon({
  className = "w-5 h-5",
  filled = false,
}: HeartIconProps) {
  if (filled) {
    return (
      <svg className={className} fill="currentColor" viewBox="0 0 24 24">
        <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
      </svg>
    );
  }
  return (
    <svg
      className={className}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
      />
    </svg>
  );
}

export function ShareIcon({ className = "w-5 h-5" }: IconProps) {
  return (
    <svg
      className={className}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"
      />
    </svg>
  );
}

export function CheckIcon({ className = "w-5 h-5" }: IconProps) {
  return (
    <svg
      className={className}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M5 13l4 4L19 7"
      />
    </svg>
  );
}

export function CheckCircleIcon({ className = "w-6 h-6" }: IconProps) {
  return (
    <svg
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      viewBox="0 0 24 24"
    >
      <circle cx="12" cy="12" r="10" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  );
}

export function XCircleIcon({ className = "w-6 h-6" }: IconProps) {
  return (
    <svg
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      viewBox="0 0 24 24"
    >
      <circle cx="12" cy="12" r="10" />
      <path d="m15 9-6 6" />
      <path d="m9 9 6 6" />
    </svg>
  );
}

// Goal icons for learning goals
export function SunIcon({ className = "w-6 h-6" }: IconProps) {
  return (
    <svg
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      viewBox="0 0 24 24"
    >
      <circle cx="12" cy="12" r="5" />
      <line x1="12" y1="1" x2="12" y2="3" />
      <line x1="12" y1="21" x2="12" y2="23" />
      <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
      <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
      <line x1="1" y1="12" x2="3" y2="12" />
      <line x1="21" y1="12" x2="23" y2="12" />
      <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
      <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
    </svg>
  );
}

export function FlameIcon({ className = "w-6 h-6" }: IconProps) {
  return (
    <svg
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      viewBox="0 0 24 24"
    >
      <path d="M12 22c4.97 0 9-4.03 9-9 0-3.87-3.13-7-3.13-7s-1.74 2-4.87 2c-3 0-5-2-5-2S4 9.13 4 13c0 4.97 4.03 9 8 9z" />
      <path d="M12 22c-2.21 0-4-1.79-4-4 0-2.21 2-4 4-4s4 1.79 4 4c0 2.21-1.79 4-4 4z" />
    </svg>
  );
}

export function BriefcaseIcon({ className = "w-6 h-6" }: IconProps) {
  return (
    <svg
      className={className}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <rect x="2" y="7" width="20" height="14" rx="2" strokeWidth={2} />
      <path
        strokeLinecap="round"
        strokeWidth={2}
        d="M16 7V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v2"
      />
      <path strokeWidth={2} d="M2 12h20" />
    </svg>
  );
}

export function CompassIcon({ className = "w-6 h-6" }: IconProps) {
  return (
    <svg
      className={className}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <circle cx="12" cy="12" r="10" strokeWidth={2} />
      <polygon
        points="16.24,7.76 14.12,14.12 7.76,16.24 9.88,9.88"
        strokeWidth={2}
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function SproutIcon({ className = "w-6 h-6" }: IconProps) {
  return (
    <svg
      className={className}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M7 20h10M12 20v-8m0 0c-2.5 0-5-2.5-5-6 5 0 5 3 5 6zm0 0c2.5 0 5-2.5 5-6-5 0-5 3-5 6z"
      />
    </svg>
  );
}

export function UsersIcon({ className = "w-6 h-6" }: IconProps) {
  return (
    <svg
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      viewBox="0 0 24 24"
    >
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

export function MountainIcon({ className = "w-6 h-6" }: IconProps) {
  return (
    <svg
      className={className}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M4 20h16M8 20l4-12 4 12M10 14l2-6 2 6"
      />
    </svg>
  );
}

export function BookOpenIcon({ className = "w-6 h-6" }: IconProps) {
  return (
    <svg
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      viewBox="0 0 24 24"
    >
      <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
      <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
    </svg>
  );
}

export function MailIcon({ className = "w-6 h-6" }: IconProps) {
  return (
    <svg
      className={className}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <rect x="2" y="4" width="20" height="16" rx="2" strokeWidth={2} />
      <path strokeLinecap="round" strokeWidth={2} d="M22 6l-10 7L2 6" />
    </svg>
  );
}

export function SettingsIcon({ className = "w-6 h-6" }: IconProps) {
  return (
    <svg
      className={className}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <circle cx="12" cy="12" r="3" strokeWidth={2} />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z"
      />
    </svg>
  );
}

// Time-of-day icons for TimeSelector
export function SunriseIcon({ className = "w-6 h-6" }: IconProps) {
  return (
    <svg
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      viewBox="0 0 24 24"
    >
      <path d="M12 2v4M4.93 10.93l2.83 2.83M2 18h4M20 18h2M19.07 10.93l-2.83 2.83M12 18a6 6 0 0 0 0-12" />
      <line x1="2" y1="22" x2="22" y2="22" />
    </svg>
  );
}

export function SunMediumIcon({ className = "w-6 h-6" }: IconProps) {
  return (
    <svg
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      viewBox="0 0 24 24"
    >
      <circle cx="12" cy="12" r="4" />
      <path d="M12 3v1M12 20v1M5.6 5.6l.7.7M17.7 17.7l.7.7M3 12h1M20 12h1M5.6 18.4l.7-.7M17.7 6.3l.7-.7" />
    </svg>
  );
}

export function SunsetIcon({ className = "w-6 h-6" }: IconProps) {
  return (
    <svg
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      viewBox="0 0 24 24"
    >
      <path d="M12 10V2M4.93 13.93l2.83-2.83M2 18h4M20 18h2M19.07 13.93l-2.83-2.83M12 18a6 6 0 0 0 0-12" />
      <line x1="2" y1="22" x2="22" y2="22" />
    </svg>
  );
}

export function ImageIcon({ className = "w-5 h-5" }: IconProps) {
  return (
    <svg
      className={className}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
      />
    </svg>
  );
}

export function SparklesIcon({ className = "w-5 h-5" }: IconProps) {
  return (
    <svg
      className={className}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z"
      />
    </svg>
  );
}

export function TextSizeIcon({ className = "w-5 h-5" }: IconProps) {
  return (
    <svg
      className={className}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <text
        x="4"
        y="16"
        fontSize="10"
        fontWeight="600"
        fill="currentColor"
        stroke="none"
      >
        A
      </text>
      <text
        x="13"
        y="19"
        fontSize="14"
        fontWeight="600"
        fill="currentColor"
        stroke="none"
      >
        A
      </text>
    </svg>
  );
}

export function GridIcon({ className = "w-5 h-5" }: IconProps) {
  return (
    <svg
      className={className}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <rect x="3" y="3" width="7" height="7" rx="1" strokeWidth={2} />
      <rect x="14" y="3" width="7" height="7" rx="1" strokeWidth={2} />
      <rect x="3" y="14" width="7" height="7" rx="1" strokeWidth={2} />
      <rect x="14" y="14" width="7" height="7" rx="1" strokeWidth={2} />
    </svg>
  );
}

/**
 * Map goal ID directly to icon component (bypasses API icon field)
 */
// eslint-disable-next-line react-refresh/only-export-components
export const GoalIconsById: Record<
  string,
  React.ComponentType<{ className?: string }>
> = {
  inner_peace: SunIcon,
  spiritual_growth: FlameIcon,
  work_excellence: BriefcaseIcon,
  decision_clarity: CompassIcon,
  personal_growth: SproutIcon,
  leadership: UsersIcon,
  resilience: MountainIcon,
  exploring: BookOpenIcon,
};

/**
 * Map icon name (from goal_taxonomy.json) to component
 */
// eslint-disable-next-line react-refresh/only-export-components
export const GoalIcons: Record<
  string,
  React.ComponentType<{ className?: string }>
> = {
  sun: SunIcon,
  flame: FlameIcon,
  briefcase: BriefcaseIcon,
  compass: CompassIcon,
  sprout: SproutIcon,
  users: UsersIcon,
  mountain: MountainIcon,
  "book-open": BookOpenIcon,
};

/**
 * LogoIcon - Themeable Geetanjali logo as inline SVG
 *
 * Uses CSS custom properties for full theme control:
 * - --logo-bg-start: Background gradient start (default: #ea580c)
 * - --logo-bg-end: Background gradient end (default: #f97316)
 * - --logo-petal-outer: Outer lotus petal color (default: #FFF8E7)
 * - --logo-petal-inner: Inner lotus petal color (default: #FFEDD5)
 * - --logo-sun-glow: Sun outer glow (default: #FCD34D)
 * - --logo-sun-core: Sun center core (default: #991B1B)
 */
interface LogoIconProps extends IconProps {
  size?: number | string;
  themed?: boolean;
}

export function LogoIcon({
  className = "",
  size = 64,
  themed = true,
}: LogoIconProps) {
  const bgStart = themed ? "var(--logo-bg-start, #ea580c)" : "#ea580c";
  const bgEnd = themed ? "var(--logo-bg-end, #f97316)" : "#f97316";
  const petalOuter = themed ? "var(--logo-petal-outer, #FFF8E7)" : "#FFF8E7";
  const petalInner = themed ? "var(--logo-petal-inner, #FFEDD5)" : "#FFEDD5";
  const sunGlow = themed ? "var(--logo-sun-glow, #FCD34D)" : "#FCD34D";
  const sunCore = themed ? "var(--logo-sun-core, #991B1B)" : "#991B1B";
  const sunHighlight = themed ? "var(--logo-sun-highlight, #FEF3C7)" : "#FEF3C7";
  const sunEdge = themed ? "var(--logo-sun-edge, #DC2626)" : "#DC2626";

  // Generate unique IDs to avoid conflicts when multiple logos on page
  const id = useId();
  const gradientId = `logoGrad${id}`;
  const sunGradId = `logoSunGrad${id}`;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 512 512"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="Geetanjali logo"
      role="img"
    >
      <defs>
        <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={bgStart} stopOpacity={1} />
          <stop offset="100%" stopColor={bgEnd} stopOpacity={1} />
        </linearGradient>
        <radialGradient id={sunGradId} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor={sunHighlight} stopOpacity={1} />
          <stop offset="40%" stopColor={sunGlow} stopOpacity={1} />
          <stop offset="100%" stopColor={sunEdge} stopOpacity={1} />
        </radialGradient>
      </defs>

      {/* Background circle - provides contrast */}
      <circle cx="256" cy="256" r="240" fill={`url(#${gradientId})`} />

      <g transform="translate(256, 256)">
        {/* Outer petals */}
        {[0, 45, 90, 135, 180, 225, 270, 315].map((angle) => (
          <ellipse
            key={`outer-${angle}`}
            cx="0"
            cy="-80"
            rx="40"
            ry="100"
            fill={petalOuter}
            opacity={0.95}
            transform={`rotate(${angle})`}
          />
        ))}

        {/* Inner petals */}
        {[0, 60, 120, 180, 240, 300].map((angle) => (
          <ellipse
            key={`inner-${angle}`}
            cx="0"
            cy="-50"
            rx="30"
            ry="70"
            fill={petalInner}
            opacity={0.98}
            transform={`rotate(${angle})`}
          />
        ))}

        {/* Sun rays */}
        <g opacity={0.5}>
          {[0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330].map(
            (angle) => (
              <path
                key={`ray-${angle}`}
                d="M 0,-35 L 6,-45 L -6,-45 Z"
                fill={sunGlow}
                transform={`rotate(${angle})`}
              />
            ),
          )}
        </g>

        {/* Sun center */}
        <circle cx="0" cy="0" r="55" fill={`url(#${sunGradId})`} />
        <circle cx="0" cy="0" r="25" fill={sunCore} />

        {/* Highlight */}
        <circle cx="-8" cy="-8" r="6" fill={sunHighlight} opacity={0.8} />
      </g>
    </svg>
  );
}
