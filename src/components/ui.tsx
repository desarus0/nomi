import { useEffect, useRef, useState, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { initials, onColor, photoSrc } from '../lib/format';
import type { Photo } from '../lib/types';

// ------------------------------------------------------------------ icons (from design source I{})
const I = {
  back: <path d="M15 5l-7 7 7 7" />,
  chev: <path d="M9 5l7 7-7 7" />,
  x: <path d="M6 6l12 12M18 6L6 18" />,
  heart: <path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z" />,
  bolt: <path d="M13 3L5 14h6l-1 7 8-11h-6l1-7z" />,
  info: <><circle cx="12" cy="12" r="9" /><path d="M12 11v5M12 8h.01" /></>,
  link: <><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1" /><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" /></>,
  qr: <><rect x="4" y="4" width="6" height="6" rx="1" /><rect x="14" y="4" width="6" height="6" rx="1" /><rect x="4" y="14" width="6" height="6" rx="1" /><path d="M14 14h2v2h-2zM18 18h2v2h-2zM14 18h1M18 14h2" /></>,
  share: <><path d="M12 3v12M8 7l4-4 4 4" /><path d="M6 11v8a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1v-8" /></>,
  search: <><circle cx="11" cy="11" r="6.5" /><path d="M16 16l4 4" /></>,
  loc: <><path d="M12 21s-6-5.5-6-11a6 6 0 0 1 12 0c0 5.5-6 11-6 11z" /><circle cx="12" cy="10" r="2.2" /></>,
  arrowloc: <path d="M20 4L4 11l7 2 2 7 7-16z" />,
  plus: <path d="M12 5v14M5 12h14" />,
  minus: <path d="M5 12h14" />,
  star: <path d="M12 3.5l2.6 5.3 5.9.9-4.2 4.1 1 5.8L12 16.9l-5.3 2.7 1-5.8-4.2-4.1 5.9-.9z" />,
  map: <><path d="M9 4L3 6v14l6-2 6 2 6-2V4l-6 2-6-2z" /><path d="M9 4v14M15 6v14" /></>,
  phone: <path d="M6 3h3l2 5-2.5 1.5a11 11 0 0 0 6 6L16 13l5 2v3a2 2 0 0 1-2 2A16 16 0 0 1 4 5a2 2 0 0 1 2-2z" />,
  walk: <><circle cx="13" cy="4.5" r="1.6" /><path d="M10 21l2-6-2-3 1-4 3 3h3M8 12l2-4M14 15l2 6" /></>,
  leaf: <><path d="M5 19c0-8 6-14 15-14 0 9-6 15-14 15" /><path d="M5 19l8-8" /></>,
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
  check: <path d="M5 12.5l4.5 4.5L19 7.5" />,
  veto: <><circle cx="12" cy="12" r="8.5" /><path d="M6 6l12 12" /></>,
  sparkle: <><path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z" /><path d="M19 16l.7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7z" /></>,
  double: <><path d="M7 12l3 3 6-6" /><path d="M3 12l3 3M11 15l6-6" /></>,
  gear: <><circle cx="12" cy="12" r="3" /><path d="M12 2.5v3M12 18.5v3M21.5 12h-3M5.5 12h-3M18.7 5.3l-2.1 2.1M7.4 16.6l-2.1 2.1M18.7 18.7l-2.1-2.1M7.4 7.4L5.3 5.3" /></>,
  trophy: <><path d="M7 4h10v5a5 5 0 0 1-10 0z" /><path d="M7 6H4v1.5A3.5 3.5 0 0 0 7.5 11M17 6h3v1.5a3.5 3.5 0 0 1-3.5 3.5" /><path d="M12 14v4M8.5 21h7M10 18h4" /></>,
  directions: <><path d="M12 2.5l9.5 9.5-9.5 9.5L2.5 12z" /><path d="M9 14v-3h6M13 9l2 2-2 2" /></>,
  copy: <><rect x="8" y="8" width="12" height="12" rx="2" /><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3" /></>,
} as const;
export type IconName = keyof typeof I;

export function Icon({ name, size = 22, color = 'currentColor', sw = 1.8, fill = 'none', className }: {
  name: IconName; size?: number; color?: string; sw?: number; fill?: string; className?: string;
}) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={fill} stroke={color} strokeWidth={sw}
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}>{I[name]}</svg>
  );
}

// ------------------------------------------------------------------ avatars
const FACES = [
  <><path d="M11 18q3-4 6 0M23 18q3-4 6 0" stroke="#111" strokeWidth="2.4" fill="none" strokeLinecap="round" /><path d="M12 24q8 10 16 0z" fill="#111" /><path d="M16 28.5q4 2.5 8 0" fill="#FF8FA3" /></>,
  <><circle cx="14" cy="17" r="2.8" fill="#111" /><circle cx="26" cy="17" r="2.8" fill="#111" /><circle cx="15" cy="16" r="0.9" fill="#fff" /><circle cx="27" cy="16" r="0.9" fill="#fff" /><ellipse cx="20" cy="27" rx="3" ry="3.6" fill="#111" /><circle cx="10" cy="23" r="2.6" fill="#fff" fillOpacity="0.3" /><circle cx="30" cy="23" r="2.6" fill="#fff" fillOpacity="0.3" /></>,
  <><rect x="8.5" y="13.5" width="10" height="6.5" rx="2.5" fill="#111" /><rect x="21.5" y="13.5" width="10" height="6.5" rx="2.5" fill="#111" /><path d="M18 16h4" stroke="#111" strokeWidth="2" /><path d="M14.5 27q6 3.5 11-1.5" stroke="#111" strokeWidth="2.4" fill="none" strokeLinecap="round" /></>,
  <><path d="M11 18q3-4 6 0" stroke="#111" strokeWidth="2.4" fill="none" strokeLinecap="round" /><circle cx="26" cy="17" r="2.8" fill="#111" /><path d="M12.5 24h15q-1 8-7.5 8t-7.5-8z" fill="#111" /><path d="M17 29.5q3 3 6 0" fill="#FF8FA3" /></>,
  <><path d="M10.5 18h6.5M23 18h6.5" stroke="#111" strokeWidth="2.4" strokeLinecap="round" /><path d="M13 27q2.3-2.5 4.6 0t4.6 0t4.6 0" stroke="#111" strokeWidth="2.2" fill="none" strokeLinecap="round" /></>,
];

function ChefHat({ size }: { size: number }) {
  return (
    <svg width={size * 0.8} height={size * 0.48} viewBox="0 0 40 24" aria-hidden="true"
      style={{ position: 'absolute', left: '50%', top: -size * 0.36, transform: 'translateX(-50%) rotate(-8deg)' }}>
      <path d="M9 17v5h22v-5c4-1 6.5-5 4.5-8.5-2-3-6-3-8-1C26.5 4 23 2 20 2s-6.5 2-7.5 5.5c-2-2-6-1.5-8 1.5C2.5 12 5 16 9 17z" fill="#fff" stroke="#111" strokeWidth="1.6" />
      <path d="M9 19h22" stroke="#111" strokeWidth="1.2" />
    </svg>
  );
}

export function Avatar({ color, face, size = 34, host = false, badge, className = '' }: {
  color: string; face: number; size?: number; host?: boolean; badge?: ReactNode; className?: string;
}) {
  return (
    <div aria-hidden="true" className={`relative flex-none ${className}`} style={{ width: size, height: size, marginTop: host && size >= 34 ? size * 0.25 : 0 }}>
      <svg width={size} height={size} viewBox="0 0 40 40" style={{ display: 'block', borderRadius: '50%' }}>
        <circle cx="20" cy="20" r="20" fill={color} />{FACES[face % FACES.length]}
      </svg>
      {host && size >= 34 && <ChefHat size={size} />}
      {badge}
    </div>
  );
}

export function OkBadge({ size = 18 }: { size?: number }) {
  return (
    <span className="absolute -right-1 -bottom-1 grid place-items-center rounded-full bg-brand" style={{ width: size, height: size, boxShadow: '0 0 0 2px #fff' }}>
      <Icon name="check" size={size * 0.62} color="#fff" sw={3.2} />
    </span>
  );
}

export function ThinkBubble() {
  return <span className="bob absolute -top-3.5 -right-4 rounded-[11px] bg-white px-[7px] py-[2px] text-[13px] font-black tracking-[1px]" style={{ boxShadow: 'inset 0 0 0 1.5px #000' }}>•••</span>;
}

// ------------------------------------------------------------------ restaurants
export function Mono({ name, color, size = 40, radius = 10, fontSize = 15 }: { name: string; color: string; size?: number; radius?: number; fontSize?: number }) {
  return (
    <div aria-hidden="true" className="grid flex-none place-items-center font-bold tracking-[-0.3px]"
      style={{ width: size, height: size, borderRadius: radius, background: color, color: onColor(color), fontSize }}>
      {initials(name)}
    </div>
  );
}

/**
 * Restaurant photo filling its (relative) parent, with scrims so white text stays readable
 * and the photographer credit Google requires. Renders nothing if there's no photo or it fails,
 * leaving the parent's identity colour showing.
 */
export function PhotoBackdrop({ photo, width = 800, onLoadState }: { photo: Photo | null | undefined; width?: number; onLoadState?: (ok: boolean) => void }) {
  const [failed, setFailed] = useState(false);
  if (!photo || failed) return null;
  return (
    <>
      <img src={photoSrc(photo.name, width)} alt="" aria-hidden="true" draggable={false} decoding="async"
        onLoad={() => onLoadState?.(true)} onError={() => { setFailed(true); onLoadState?.(false); }}
        className="pointer-events-none absolute inset-0 h-full w-full object-cover select-none" />
      <div aria-hidden="true" className="pointer-events-none absolute inset-0"
        style={{ background: 'linear-gradient(to bottom, rgba(0,0,0,0.45) 0%, rgba(0,0,0,0) 28%, rgba(0,0,0,0) 45%, rgba(0,0,0,0.78) 100%)' }} />
      {photo.attribution && (
        <span className="pointer-events-none absolute right-2.5 bottom-1.5 z-10 max-w-[70%] truncate text-[10px] text-white/80">Photo: {photo.attribution}</span>
      )}
    </>
  );
}

/** Text colour for content over a restaurant tile: white over photos, otherwise contrast with the tile colour. */
export const heroText = (color: string, hasPhoto: boolean) => (hasPhoto ? '#FFFFFF' : onColor(color));

// ------------------------------------------------------------------ buttons
type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & { icon?: IconName };

export function PrimaryButton({ children, icon, className = '', ...rest }: BtnProps) {
  return (
    <button {...rest} className={`press edge-ink flex h-[54px] w-full items-center justify-center gap-2 rounded-[27px] bg-ink text-[17px] font-bold text-white disabled:bg-[#8E8E93] disabled:shadow-[0_5px_0_#6b6b70] ${className}`}>
      {icon && <Icon name={icon} size={20} color="#fff" sw={2} />}{children}
    </button>
  );
}

export function SecondaryButton({ children, icon, className = '', ...rest }: BtnProps) {
  return (
    <button {...rest} className={`press edge-outline flex h-[54px] w-full items-center justify-center gap-2 rounded-[27px] bg-white text-[17px] font-bold text-ink disabled:opacity-50 ${className}`}>
      {icon && <Icon name={icon} size={20} sw={2} />}{children}
    </button>
  );
}

export function BackLink({ to, label, onClick }: { to?: string; label: string; onClick?: () => void }) {
  const cls = 'flex min-h-11 items-center gap-0.5 px-1.5 text-[17px] text-brand';
  const inner = <><Icon name="back" size={22} color="currentColor" sw={2.4} />{label}</>;
  return to ? <Link to={to} className={cls}>{inner}</Link> : <button onClick={onClick} className={cls}>{inner}</button>;
}

export function NavBar({ title, left, right }: { title: string; left?: ReactNode; right?: ReactNode }) {
  return (
    <div className="grid h-11 flex-none grid-cols-[1fr_auto_1fr] items-center px-2">
      <div className="justify-self-start">{left}</div>
      <h1 className="m-0 text-[17px] font-semibold tracking-[-0.4px]">{title}</h1>
      <div className="justify-self-end">{right}</div>
    </div>
  );
}

export function CloseButton({ onClick }: { onClick: () => void }) {
  return (
    <button onClick={onClick} aria-label="Close" className="grid h-11 w-11 place-items-center">
      <span className="grid h-[30px] w-[30px] place-items-center rounded-full bg-fill"><Icon name="x" size={13} color="#3C3C43" sw={2.8} /></span>
    </button>
  );
}

// ------------------------------------------------------------------ points & power-ups
export function Points({ n, suffix = '', className = '' }: { n: number; suffix?: string; className?: string }) {
  return (
    <span className={`inline-flex h-7 items-center gap-[5px] rounded-[14px] bg-lime px-[11px] text-[15px] font-bold tracking-[-0.2px] text-black tabular-nums ${className}`}>
      <Icon name="bolt" size={14} color="#000" sw={2.2} fill="#000" />{n}{suffix}
      <span className="sr-only"> points</span>
    </span>
  );
}

export function PuIcon({ name, size = 40 }: { name: IconName; size?: number }) {
  return (
    <span className="grid flex-none place-items-center bg-black" style={{ width: size, height: size, borderRadius: size * 0.27 }}>
      <Icon name={name} size={size * 0.55} color="var(--color-lime)" sw={2.2} />
    </span>
  );
}

export function Burst({ text, size = 84, rot = -10 }: { text: string; size?: number; rot?: number }) {
  const pts = Array.from({ length: 24 }, (_, i) => {
    const r = i % 2 === 0 ? 50 : 41, a = (Math.PI * 2 * i) / 24;
    return `${(50 + r * Math.cos(a)).toFixed(1)},${(50 + r * Math.sin(a)).toFixed(1)}`;
  }).join(' ');
  return (
    <span className="relative grid flex-none place-items-center" style={{ width: size, height: size, transform: `rotate(${rot}deg)` }}>
      <svg width={size} height={size} viewBox="0 0 100 100" aria-hidden="true" className="absolute inset-0">
        <polygon points={pts} fill="var(--color-lime)" stroke="#000" strokeWidth="3" strokeLinejoin="round" />
      </svg>
      <span className="disp relative tracking-[-0.5px]" style={{ fontSize: size * 0.3 }}>{text}</span>
    </span>
  );
}

// ------------------------------------------------------------------ party code
const ROTS = [-4, 3, -2, 4, -3];
export function CodeTiles({ code, size = 54, fontSize = 30 }: { code: string; size?: number; fontSize?: number }) {
  return (
    <div role="img" aria-label={`Party code ${code.split('').join(' ')}`} className="flex justify-center gap-2">
      {code.split('').map((ch, i) => (
        <span key={i} aria-hidden="true" className="disp edge-outline grid place-items-center rounded-xl bg-white"
          style={{ width: size, height: size + 6, fontSize, transform: `rotate(${ROTS[i % 5]}deg)` }}>{ch}</span>
      ))}
    </div>
  );
}

// ------------------------------------------------------------------ lists & controls
export function Section({ header, footer, children, className = '' }: { header?: ReactNode; footer?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={className}>
      {header && <h2 className="m-0 mb-[7px] ml-4 text-[13px] font-normal tracking-normal text-sec uppercase">{header}</h2>}
      <div className="overflow-hidden rounded-xl bg-white">{children}</div>
      {footer && <p className="mx-4 mt-[7px] mb-0 text-[13px] tracking-normal text-sec">{footer}</p>}
    </section>
  );
}

export function Row({ lead, title, sub, trail, last, dim, onClick, inset = 60, className = '' }: {
  lead?: ReactNode; title: ReactNode; sub?: ReactNode; trail?: ReactNode; last?: boolean; dim?: boolean;
  onClick?: () => void; inset?: number; className?: string;
}) {
  const body = (
    <>
      {lead}
      <div className="min-w-0 flex-1 text-left">
        <div className="truncate text-[17px] tracking-[-0.4px]">{title}</div>
        {sub && <div className="mt-px truncate text-[13px] tracking-[-0.1px] text-sec">{sub}</div>}
      </div>
      {trail}
      {!last && <div className="absolute right-0 bottom-0 h-[0.5px] bg-sep" style={{ left: inset }} />}
    </>
  );
  const cls = `relative flex w-full items-center gap-3 px-4 py-2 ${sub ? 'min-h-[60px]' : 'min-h-[46px]'} ${dim ? 'opacity-45' : ''} ${className}`;
  return onClick ? <button type="button" onClick={onClick} className={cls}>{body}</button> : <div className={cls}>{body}</div>;
}

export function Toggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={label} onClick={() => onChange(!on)}
      className={`relative block h-[31px] w-[51px] flex-none rounded-2xl transition-colors ${on ? 'bg-brand' : 'bg-[#E9E9EA]'}`}>
      <span className="absolute top-[2px] h-[27px] w-[27px] rounded-full bg-white shadow-[0_3px_8px_rgba(0,0,0,0.15),0_1px_1px_rgba(0,0,0,0.16)] transition-[left]" style={{ left: on ? 22 : 2 }} />
    </button>
  );
}

export function Stepper({ value, onChange, min, max, step = 1, label }: { value: number; onChange: (v: number) => void; min: number; max: number; step?: number; label: string }) {
  const btn = 'grid h-11 w-12 place-items-center disabled:opacity-30';
  return (
    <div className="flex h-8 items-center overflow-hidden rounded-lg bg-[#EEEEF0]">
      <button type="button" className={btn} aria-label={`Decrease ${label}`} disabled={value <= min} onClick={() => onChange(Math.max(min, value - step))}><Icon name="minus" size={16} sw={2.2} /></button>
      <span className="h-[18px] w-px bg-[#C7C7CC]" />
      <button type="button" className={btn} aria-label={`Increase ${label}`} disabled={value >= max} onClick={() => onChange(Math.min(max, value + step))}><Icon name="plus" size={16} sw={2.2} /></button>
    </div>
  );
}

export const TagNext = () => <span className="rounded-[5px] bg-brand-tint px-[7px] py-[3px] text-[11px] font-extrabold tracking-[0.4px] text-brand">NEXT</span>;
export const TagOut = () => <span className="rounded-[5px] bg-neg-tint px-[7px] py-[3px] text-[11px] font-extrabold tracking-[0.4px] text-neg">OUT</span>;

export function Stamp({ text, color, rot }: { text: string; color: string; rot: number }) {
  return (
    <span className="inline-block rounded-lg border-[2.5px] bg-white/95 px-2.5 text-[26px] font-black tracking-[1px]"
      style={{ borderColor: color, color, transform: `rotate(${rot}deg)` }}>{text}</span>
  );
}

export function Bubble({ text, bg, side = 'left' }: { text: string; bg: string; side?: 'left' | 'right' }) {
  return (
    <span className="relative inline-block rounded-[14px] px-2.5 py-1 text-[13px] font-extrabold text-white" style={{ background: bg, borderBottomLeftRadius: side === 'left' ? 4 : 14, borderBottomRightRadius: side === 'right' ? 4 : 14 }}>{text}</span>
  );
}

export function RingTimer({ sec, frac }: { sec: number; frac: number }) {
  const deg = Math.max(0, Math.min(1, frac)) * 360;
  return (
    <div role="timer" aria-label={`${sec} seconds left`} className="grid h-[50px] w-[50px] place-items-center rounded-full"
      style={{ background: `conic-gradient(${sec <= 5 ? 'var(--color-neg)' : '#000'} 0 ${deg}deg, #E3E3E8 ${deg}deg)` }}>
      <span className={`grid h-10 w-10 place-items-center rounded-full bg-bg text-base font-extrabold tabular-nums ${sec <= 5 ? 'text-neg' : ''}`}>{sec}</span>
    </div>
  );
}

// ------------------------------------------------------------------ layout
/** Full-height mobile screen; content scrolls, footer sticks to the bottom. */
export function Screen({ children, footer, bg = 'bg-bg', className = '' }: { children: ReactNode; footer?: ReactNode; bg?: string; className?: string }) {
  return (
    <div className={`mx-auto flex h-dvh max-w-[480px] flex-col ${bg}`} style={{ paddingTop: 'env(safe-area-inset-top)' }}>
      <div className={`min-h-0 flex-1 overflow-y-auto ${className}`}>{children}</div>
      {footer && <div className="flex-none px-4 pt-2" style={{ paddingBottom: 'max(16px, env(safe-area-inset-bottom))' }}>{footer}</div>}
    </div>
  );
}

/** Bottom sheet over the current screen (Details, Power-ups, Veto, Wildcard). */
export function Sheet({ onClose, children, label }: { onClose: () => void; children: ReactNode; label: string }) {
  const ref = useRef<HTMLDivElement>(null);
  // Parents (e.g. the voting screen) re-render several times a second for timers, which hands us a
  // new onClose each time. Keep it in a ref so the effects below run once, and only move focus into
  // the sheet on open; never steal it back from an input inside the sheet.
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close.current(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);
  useEffect(() => {
    if (!ref.current?.contains(document.activeElement)) ref.current?.focus();
  }, []);
  return (
    <div className="fixed inset-0 z-40 flex justify-center">
      <div className="fade-in absolute inset-0 bg-black/40" onClick={onClose} aria-hidden="true" />
      <div ref={ref} tabIndex={-1} role="dialog" aria-modal="true" aria-label={label}
        className="sheet-up relative mt-auto flex max-h-[92dvh] w-full max-w-[480px] flex-col rounded-t-[14px] bg-bg outline-none"
        style={{ paddingBottom: 'max(16px, env(safe-area-inset-bottom))' }}>
        <div className="mx-auto mt-1.5 h-[5px] w-9 flex-none rounded-[3px] bg-[#C7C7CC]" aria-hidden="true" />
        {children}
      </div>
    </div>
  );
}

export function SheetHead({ title, onClose, right, back }: { title: ReactNode; onClose: () => void; right?: ReactNode; back?: ReactNode }) {
  return (
    <div className="flex-none">
      {back && <div className="px-2 pt-1">{back}</div>}
      <div className="flex items-center justify-between pt-1.5 pr-2 pl-4">
        <h2 className="disp m-0 text-[26px] tracking-[-0.6px]">{title}</h2>
        <div className="flex items-center gap-1">{right}<CloseButton onClick={onClose} /></div>
      </div>
    </div>
  );
}

export function ErrorText({ children }: { children: ReactNode }) {
  if (!children) return null;
  return <p role="alert" className="mx-4 my-2 rounded-lg bg-neg-tint px-3 py-2 text-[14px] text-neg">{children}</p>;
}

export function Centered({ children }: { children: ReactNode }) {
  return <div className="mx-auto flex h-dvh max-w-[480px] flex-col items-center justify-center gap-4 p-8 text-center">{children}</div>;
}

export function Spinner() {
  return <span role="status" aria-label="Loading" className="inline-block h-6 w-6 animate-spin rounded-full border-[3px] border-fill border-t-ink motion-reduce:animate-none" />;
}
