import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement>;

const base = (props: IconProps) => ({
  width: 20,
  height: 20,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  ...props,
});

export const IconMenu = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M4 6h16M4 12h16M4 18h16" />
  </svg>
);
export const IconHome = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M3 10.5 12 3l9 7.5" />
    <path d="M5 9.5V21h14V9.5" />
  </svg>
);
export const IconUsers = (p: IconProps) => (
  <svg {...base(p)}>
    <circle cx="9" cy="8" r="3.2" />
    <path d="M2.5 20c.8-3.4 3.3-5.5 6.5-5.5s5.7 2.1 6.5 5.5" />
    <circle cx="17" cy="8.5" r="2.6" />
    <path d="M15.5 14.8c2.6.3 4.5 2.2 5 5.2" />
  </svg>
);
export const IconCalendar = (p: IconProps) => (
  <svg {...base(p)}>
    <rect x="3.5" y="5" width="17" height="15.5" rx="2" />
    <path d="M3.5 9.5h17M8 3v4M16 3v4" />
  </svg>
);
export const IconFile = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M7 3h7l4 4v13a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z" />
    <path d="M14 3v4h4" />
  </svg>
);
export const IconMapPin = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M12 21s7-6.6 7-11.5A7 7 0 0 0 5 9.5C5 14.4 12 21 12 21Z" />
    <circle cx="12" cy="9.5" r="2.3" />
  </svg>
);
export const IconBell = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M6 9a6 6 0 1 1 12 0c0 5 2 6 2 6H4s2-1 2-6Z" />
    <path d="M10 20a2 2 0 0 0 4 0" />
  </svg>
);
export const IconMail = (p: IconProps) => (
  <svg {...base(p)}>
    <rect x="3" y="5" width="18" height="14" rx="2" />
    <path d="m4 6.5 8 6 8-6" />
  </svg>
);
export const IconChevronDown = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="m6 9 6 6 6-6" />
  </svg>
);
export const IconBed = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M3 18v-7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v7" />
    <path d="M3 15h18M3 18v2M21 18v2M6 9V6a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1v3" />
  </svg>
);
export const IconClipboard = (p: IconProps) => (
  <svg {...base(p)}>
    <rect x="6" y="4" width="12" height="17" rx="2" />
    <rect x="9" y="2.5" width="6" height="3" rx="1" />
    <path d="M9 11h6M9 15h6" />
  </svg>
);
export const IconFlask = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M9 3h6M10 3v6l-5.5 9a1.5 1.5 0 0 0 1.3 2.2h12.4a1.5 1.5 0 0 0 1.3-2.2L14 9V3" />
    <path d="M7 15h10" />
  </svg>
);
export const IconPill = (p: IconProps) => (
  <svg {...base(p)}>
    <rect x="3" y="9" width="18" height="6" rx="3" transform="rotate(-45 12 12)" />
    <path d="M9.5 9.5 14.5 14.5" />
  </svg>
);
export const IconChart = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M4 20V10M11 20V4M18 20v-7" />
  </svg>
);
export const IconSettings = (p: IconProps) => (
  <svg {...base(p)}>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.9.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z" />
  </svg>
);
export const IconLogout = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
    <path d="M16 17l5-5-5-5M21 12H9" />
  </svg>
);
export const IconUser = (p: IconProps) => (
  <svg {...base(p)}>
    <circle cx="12" cy="8" r="3.5" />
    <path d="M4.5 20c1-4 4-6.2 7.5-6.2s6.5 2.2 7.5 6.2" />
  </svg>
);
export const IconLock = (p: IconProps) => (
  <svg {...base(p)}>
    <rect x="5" y="11" width="14" height="9" rx="2" />
    <path d="M8 11V7a4 4 0 1 1 8 0v4" />
  </svg>
);
export const IconSearch = (p: IconProps) => (
  <svg {...base(p)}>
    <circle cx="11" cy="11" r="6.5" />
    <path d="m20 20-3.6-3.6" />
  </svg>
);
export const IconPlus = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M12 5v14M5 12h14" />
  </svg>
);
export const IconArrowRight = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M5 12h14M13 6l6 6-6 6" />
  </svg>
);
export const IconHeart = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M3 12.5 12 21l9-8.5A5 5 0 0 0 13.5 6L12 7.5 10.5 6A5 5 0 0 0 3 12.5Z" />
  </svg>
);
export const IconTransfer = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M4 8h13l-3-3M20 16H7l3 3" />
  </svg>
);
