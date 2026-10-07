import type { ReactNode, SVGProps } from "react";

/** Icon set of the reference prototype (24×24, stroke 1.7, round caps). */
const PATHS = {
  home: <path d="M4 11l8-6 8 6v8a1 1 0 0 1-1 1h-4v-5H9v5H5a1 1 0 0 1-1-1z" />,
  req: (
    <>
      <path d="M6 3h9l4 4v14H6z" />
      <path d="M15 3v4h4M9 12h7M9 16h5" />
    </>
  ),
  review: (
    <>
      <path d="M4 20l4-1 11-11-3-3L5 16z" />
      <path d="M14 7l3 3" />
    </>
  ),
  appr: (
    <>
      <circle cx="12" cy="9" r="5" />
      <path d="M9 13l-2 8 5-3 5 3-2-8" />
    </>
  ),
  box: (
    <>
      <path d="M3 7l9-4 9 4v10l-9 4-9-4z" />
      <path d="M3 7l9 4 9-4M12 11v10" />
    </>
  ),
  chart: <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />,
  bell: (
    <>
      <path d="M6 16V11a6 6 0 1 1 12 0v5l2 2H4z" />
      <path d="M10 21h4" />
    </>
  ),
  mega: (
    <>
      <path d="M3 10v4h4l7 5V5L7 10z" />
      <path d="M18 9a4 4 0 0 1 0 6" />
    </>
  ),
  folder: <path d="M3 6h7l2 2h9v11H3z" />,
  brace: (
    <path d="M8 4c-2 0-2 2-2 4s-1 4-3 4c2 0 3 2 3 4s0 4 2 4M16 4c2 0 2 2 2 4s1 4 3 4c-2 0-3 2-3 4s0 4-2 4" />
  ),
  users: (
    <>
      <circle cx="9" cy="8" r="3.5" />
      <path d="M2 20c.8-3.5 3.6-5 7-5s6.2 1.5 7 5" />
      <path d="M16 4.5a3.5 3.5 0 0 1 0 7M18 15c2 .6 3.4 2.2 4 5" />
    </>
  ),
  build: <path d="M4 21V5l8-2v18M12 8h8v13M8 8v.01M8 12v.01M8 16v.01M16 12v.01M16 16v.01M2 21h20" />,
  book: (
    <>
      <path d="M4 4h6a3 3 0 0 1 3 3v14a2 2 0 0 0-2-2H4z" />
      <path d="M20 4h-4a3 3 0 0 0-3 3v14a2 2 0 0 1 2-2h5z" />
    </>
  ),
  plus: <path d="M12 5v14M5 12h14" />,
  x: <path d="M6 6l12 12M18 6L6 18" />,
  menu: <path d="M4 7h16M4 12h16M4 17h16" />,
  copy: (
    <>
      <rect x="8" y="8" width="12" height="12" rx="2" />
      <path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3" />
    </>
  ),
  down: <path d="M12 4v12M7 11l5 5 5-5M4 20h16" />,
  ext: <path d="M14 4h6v6M20 4l-9 9M18 14v6H4V6h6" />,
  list: <path d="M9 6h11M9 12h11M9 18h11M4 6h.01M4 12h.01M4 18h.01" />,
  search: (
    <>
      <circle cx="11" cy="11" r="6" />
      <path d="M20 20l-4.5-4.5" />
    </>
  ),
  cust: (
    <>
      <rect x="3" y="7" width="18" height="13" rx="2" />
      <path d="M9 7V4h6v3M3 12h18M12 12v3" />
    </>
  ),
  seed: (
    <>
      <ellipse cx="12" cy="6" rx="7" ry="3" />
      <path d="M5 6v12c0 1.7 3.1 3 7 3s7-1.3 7-3V6" />
      <path d="M5 12c0 1.7 3.1 3 7 3s7-1.3 7-3" />
    </>
  ),
  /* 건의하기 (교정 결과 화면설계 ④) */
  send: <path d="M21 3L10 14M21 3l-7 18-4-7-7-4z" />,
} satisfies Record<string, ReactNode>;

export type IconName = keyof typeof PATHS;
export const ICON_NAMES = Object.keys(PATHS) as IconName[];

export interface IconProps extends Omit<SVGProps<SVGSVGElement>, "name"> {
  name: IconName;
  /** Rendered width/height attribute. Omit to size from the surrounding component CSS. */
  size?: number;
}

export function Icon({ name, size, ...rest }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      width={size}
      height={size}
      {...rest}
    >
      {PATHS[name]}
    </svg>
  );
}

/** Content-type glyphs (stroke 1.8). a = 알림톡, s = 문자, r = RCS, f = 자유입력형. */
const GLYPHS = {
  a: <path d="M4 5h16v11H9l-5 4z" />,
  s: (
    <>
      <rect x="3" y="6" width="18" height="12" rx="2" />
      <path d="M3 8l9 6 9-6" />
    </>
  ),
  r: (
    <>
      <rect x="3" y="5" width="8" height="14" rx="1.5" />
      <rect x="13" y="5" width="8" height="14" rx="1.5" />
    </>
  ),
  f: (
    <>
      <path d="M6 3h9l4 4v14H6z" />
      <path d="M15 3v4h4" />
    </>
  ),
} satisfies Record<string, ReactNode>;

export type TypeGlyphName = keyof typeof GLYPHS;

export interface TypeGlyphProps extends SVGProps<SVGSVGElement> {
  glyph: TypeGlyphName;
}

export function TypeGlyph({ glyph, ...rest }: TypeGlyphProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...rest}
    >
      {GLYPHS[glyph]}
    </svg>
  );
}

/** Empty-state illustration (document + magnifier), drawn with theme tokens. */
export function EmptyArt({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 120 72" fill="none" aria-hidden="true" focusable="false">
      <rect x="18" y="10" width="62" height="50" rx="6" fill="var(--surface)" stroke="var(--line2)" />
      <path d="M28 24h34M28 33h26M28 42h30" stroke="var(--line2)" strokeWidth="3" strokeLinecap="round" />
      <path d="M28 33h26" stroke="var(--brand)" strokeWidth="7" strokeLinecap="round" opacity=".7" />
      <circle cx="86" cy="46" r="14" fill="var(--surface)" stroke="var(--navy)" strokeWidth="2.5" />
      <path d="M96 56l8 8" stroke="var(--navy)" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}
