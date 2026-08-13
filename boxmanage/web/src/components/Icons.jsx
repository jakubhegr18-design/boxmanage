function base(children, { size = 20, className = '', strokeWidth = 2 } = {}) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

export const Home = (p) => base(<><path d="M3 10.5 12 3l9 7.5" /><path d="M5 9.5V21h14V9.5" /><path d="M9.5 21v-6h5v6" /></>, p);
export const Scan = (p) => base(<><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><path d="M14 14h3v3h-3z" /><path d="M21 14v.01" /><path d="M14 21v.01" /><path d="M21 21v.01" /></>, p);
export const Boxes = (p) => base(<><path d="M16.5 9.4 7.55 4.24" /><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" /><path d="m3.29 7 8.71 5 8.71-5" /><path d="M12 22V12" /></>, p);
export const Plus = (p) => base(<><path d="M12 5v14" /><path d="M5 12h14" /></>, p);
export const Printer = (p) => base(<><path d="M6 9V2h12v7" /><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" /><rect x="6" y="14" width="12" height="8" /></>, p);
export const Pin = (p) => base(<><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0z" /><circle cx="12" cy="10" r="3" /></>, p);
export const Download = (p) => base(<><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><path d="m7 10 5 5 5-5" /><path d="M12 15V3" /></>, p);
export const Users = (p) => base(<><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></>, p);
export const Settings = (p) => base(<><path d="M21 4h-7" /><path d="M10 4H3" /><path d="M21 12h-9" /><path d="M8 12H3" /><path d="M21 20h-5" /><path d="M12 20H3" /><path d="M14 2v4" /><path d="M8 10v4" /><path d="M16 18v4" /></>, p);
export const LogOut = (p) => base(<><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><path d="m16 17 5-5-5-5" /><path d="M21 12H9" /></>, p);
export const Sun = (p) => base(<><circle cx="12" cy="12" r="4" /><path d="M12 2v2" /><path d="M12 20v2" /><path d="m4.93 4.93 1.41 1.41" /><path d="m17.66 17.66 1.41 1.41" /><path d="M2 12h2" /><path d="M20 12h2" /><path d="m6.34 17.66-1.41 1.41" /><path d="m19.07 4.93-1.41 1.41" /></>, p);
export const Moon = (p) => base(<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />, p);
export const Menu = (p) => base(<><path d="M4 6h16" /><path d="M4 12h16" /><path d="M4 18h16" /></>, p);
export const X = (p) => base(<><path d="M18 6 6 18" /><path d="m6 6 12 12" /></>, p);
export const Edit = (p) => base(<path d="M17 3a2.83 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5z" />, p);
export const Trash = (p) => base(<><path d="M3 6h18" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" /><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /><path d="M10 11v6" /><path d="M14 11v6" /></>, p);
export const ChevronLeft = (p) => base(<path d="m15 18-6-6 6-6" />, p);
export const ChevronRight = (p) => base(<path d="m9 18 6-6-6-6" />, p);
export const Search = (p) => base(<><circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" /></>, p);
export const Clipboard = (p) => base(<><rect x="8" y="2" width="8" height="4" rx="1" /><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" /><path d="M12 11h4" /><path d="M12 16h4" /><path d="M8 11h.01" /><path d="M8 16h.01" /></>, p);
export const History = (p) => base(<><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 3" /></>, p);
export const QrCode = (p) => base(<><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><path d="M14 14h3v3h-3z" /><path d="M21 14v3" /><path d="M14 21h3" /><path d="M21 21h.01" /></>, p);
export const Lock = (p) => base(<><rect x="4" y="11" width="16" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></>, p);
export const Bluetooth = (p) => base(<path d="m7 7 10 10-5 5V2l5 5L7 17" />, p);
export const Remote = (p) => base(<><rect x="2" y="4" width="20" height="13" rx="2" /><path d="M8 21h8" /><path d="M12 17v4" /><path d="m7 9 2 2-2 2" /><path d="m17 9-2 2 2 2" /></>, p);
export const RefreshCw = (p) => base(<><path d="M21 12a9 9 0 1 1-2.64-6.36" /><path d="M21 3v6h-6" /></>, p);
export const Bulb = (p) => base(<><path d="M9 18h6" /><path d="M10 22h4" /><path d="M15.09 14c.18-.98.65-1.74 1.41-2.5A4.65 4.65 0 0 0 18 8 6 6 0 0 0 6 8c0 1 .23 2.23 1.5 3.5.76.76 1.23 1.52 1.41 2.5" /></>, p);
export const Camera = (p) => base(<><path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z" /><circle cx="12" cy="13" r="3" /></>, p);
export const Bell = (p) => base(<><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" /><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" /></>, p);
export const Check = (p) => base(<path d="M20 6 9 17l-5-5" />, p);

export function BrandMark({ size = 34, className = '' }) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 48 48" aria-hidden="true">
      <defs>
        <linearGradient id="bm-grad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#6366f1" />
          <stop offset="1" stopColor="#8b5cf6" />
        </linearGradient>
      </defs>
      <rect x="2" y="2" width="44" height="44" rx="12" fill="url(#bm-grad)" />
      <rect x="11" y="11" width="26" height="26" rx="6" fill="#fff" />
      <rect x="16" y="16" width="16" height="16" rx="3" fill="#4f46e5" />
      <rect x="16" y="16" width="6" height="6" rx="1.5" fill="#fff" />
      <rect x="26" y="16" width="6" height="6" rx="1.5" fill="#fff" />
      <rect x="16" y="26" width="6" height="6" rx="1.5" fill="#fff" />
    </svg>
  );
}
