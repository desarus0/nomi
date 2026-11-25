import { useEffect, useMemo, useRef, useState, type PointerEvent as RPointerEvent, type ReactNode } from 'react';
import { api } from '../lib/api';
import { fmtMiles, distanceMiles, photoSrc, price, roundsFor, shuffleFor, todayHours } from '../lib/format';
import { useParty } from '../lib/party';
import type { Choice, Restaurant } from '../lib/types';
import { Avatar, ErrorText, Icon, PhotoBackdrop, Points, RingTimer, Stamp, heroText } from '../components/ui';
import { DetailsSheet } from './sheets/DetailsSheet';
import { PowerUpSheet } from './sheets/PowerUpSheet';

// Fig. 7 – Swipe to vote (FR02, FR03): one card at a time; Details and Power-ups open as sheets.
export default function Swipe() {
  const { state, me, inPlay, round, now, playerById, refresh } = useParty();
  const { party, my_votes } = state;
  const [local, setLocal] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [sheet, setSheet] = useState<'details' | 'powerups' | null>(null);
  const [fly, setFly] = useState<{ id: string; dir: 1 | -1 } | null>(null);

  const deck = useMemo(() => shuffleFor(inPlay, me.id), [inPlay, me.id]);
  const voted = useMemo(() => new Set([...my_votes.map((v) => v.restaurant_id), ...local]), [my_votes, local]);
  const remaining = deck.filter((r) => !voted.has(r.id));
  const top = remaining[0];
  const cardIndex = deck.length - remaining.length + 1;
  const totalRounds = party.current_round - 1 + roundsFor(inPlay.length);

  // Per-card timer: starts when a card reaches the top (or when the round starts).
  const [shownAt, setShownAt] = useState(() => Date.now());
  const startsAt = round ? new Date(round.starts_at).getTime() : 0;
  useEffect(() => { setShownAt(Math.max(Date.now(), startsAt)); }, [top?.id, startsAt]);
  const left = Math.max(0, Math.ceil(party.time_per_card - (now - shownAt) / 1000));
  const skipped = useRef<string | null>(null);

  async function vote(r: Restaurant, choice: Choice) {
    if (voted.has(r.id)) return;
    setSheet(null);
    if (choice !== 'skip') { setFly({ id: r.id, dir: choice === 'yum' ? 1 : -1 }); await new Promise((res) => setTimeout(res, 180)); }
    setFly(null);
    setLocal((s) => new Set(s).add(r.id));
    try {
      await api.vote(party.id, r.id, choice);
      setError(null);
    } catch (e) {
      setError((e as Error).message);
      setLocal((s) => { const n = new Set(s); n.delete(r.id); return n; });
    }
    refresh();
  }

  // Time ran out on this card: it doesn't count either way.
  useEffect(() => {
    if (top && left === 0 && skipped.current !== top.id && now >= startsAt) {
      skipped.current = top.id;
      vote(top, 'skip');
    }
  });

  // Keyboard: ← Nope, → Yum.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (sheet || !top) return;
      if (e.key === 'ArrowLeft') vote(top, 'nope');
      if (e.key === 'ArrowRight') vote(top, 'yum');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const myPlay = state.power_ups.find((p) => p.round_id === round?.id && p.player_id === me.id);

  return (
    <div className="mx-auto flex h-dvh max-w-[480px] flex-col overflow-hidden bg-bg" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
      <header className="flex flex-none items-center justify-between px-5 pt-1.5">
        <div className="w-[110px]">
          <div className="text-[13px] font-medium text-sec">Round {party.current_round} of {totalRounds}</div>
          <div className="disp text-[20px]">Card {Math.min(cardIndex, deck.length)} of {deck.length}</div>
        </div>
        <RingTimer sec={left} frac={left / party.time_per_card} />
        <div className="flex w-[110px] justify-end"><Points n={me.points} /></div>
      </header>
      <div className="mt-3 flex flex-none gap-1 px-5" aria-hidden="true">
        {deck.map((r, i) => <span key={r.id} className={`h-1 flex-1 rounded-sm ${i < cardIndex - 1 ? 'bg-black' : i === cardIndex - 1 ? 'bg-[#8E8E93]' : 'bg-[#D1D1D6]'}`} />)}
      </div>
      {state.my_double_pending && (
        <p className="mx-auto mt-2 mb-0 flex items-center gap-1.5 rounded-full bg-black px-3 py-1 text-[13px] font-semibold text-lime"><Icon name="double" size={14} color="currentColor" sw={2.4} />Double Vote: your next Yum counts twice</p>
      )}
      <ErrorText>{error}</ErrorText>

      <div className="relative mx-4 mt-4 min-h-0 flex-1">
        {remaining.slice(1, 3).reverse().map((r, i, arr) => {
          const depth = arr.length - i;
          return <div key={r.id} aria-hidden="true" className="absolute inset-0 rounded-3xl" style={{ background: r.color, transform: `translate(${depth * 6}px, ${depth * 8}px) rotate(${depth * 2}deg)`, opacity: 0.9 }} />;
        })}
        {top ? (
          <Card key={top.id} r={top} fly={fly?.id === top.id ? fly.dir : null}
            onVote={(c) => vote(top, c)} onDetails={() => setSheet('details')}
            meta={{ dist: fmtMiles(distanceMiles(party, top)), hours: todayHours(top), by: playerById(top.added_by) }} />
        ) : (
          <div className="grid h-full place-items-center text-sec">Sending your votes…</div>
        )}
        {/* Warm the cache for the next card's photo so it appears instantly */}
        {remaining[1]?.photos?.[0] && <img src={photoSrc(remaining[1].photos[0].name, 800)} alt="" aria-hidden="true" className="hidden" />}
      </div>

      <div className="flex flex-none items-start justify-center gap-9 pt-4" style={{ paddingBottom: 'max(18px, env(safe-area-inset-bottom))' }}>
        <RoundBtn label="Nope" onClick={() => top && vote(top, 'nope')} disabled={!top}
          className="h-[62px] w-[62px] border-[3px] border-neg bg-white text-neg" icon={<Icon name="x" size={30} sw={3} />} labelClass="text-neg" />
        <RoundBtn label={myPlay ? 'Played' : 'Power-up'} onClick={() => setSheet('powerups')} disabled={!party.powerups_on}
          className="mt-[7px] h-12 w-12 bg-black text-lime" icon={<Icon name="bolt" size={22} sw={2.2} fill="currentColor" />} labelClass="text-black" />
        <RoundBtn label="Yum" onClick={() => top && vote(top, 'yum')} disabled={!top}
          className="h-[62px] w-[62px] border-[3px] border-brand bg-white text-brand" icon={<Icon name="heart" size={30} sw={2.6} fill="currentColor" />} labelClass="text-brand" />
      </div>

      {sheet === 'details' && top && <DetailsSheet r={top} onClose={() => setSheet(null)} onVote={(c) => vote(top, c)} />}
      {sheet === 'powerups' && <PowerUpSheet onClose={() => setSheet(null)} />}
    </div>
  );
}

function RoundBtn({ label, onClick, disabled, className, icon, labelClass }: {
  label: string; onClick: () => void; disabled?: boolean; className: string; icon: ReactNode; labelClass: string;
}) {
  return (
    <button onClick={onClick} disabled={disabled} className="flex flex-col items-center gap-1 disabled:opacity-40">
      <span className={`press grid place-items-center rounded-full ${className}`}>{icon}</span>
      <span className={`text-[13px] font-semibold ${labelClass}`}>{label}</span>
    </button>
  );
}

function Card({ r, onVote, onDetails, fly, meta }: {
  r: Restaurant; onVote: (c: Choice) => void; onDetails: () => void; fly: 1 | -1 | null;
  meta: { dist: string | null; hours: string | null; by: { name: string; color: string; face: number } | undefined };
}) {
  const [dx, setDx] = useState(0);
  const [dragging, setDragging] = useState(false);
  const start = useRef<{ x: number; y: number; id: number } | null>(null);
  const [photoOk, setPhotoOk] = useState(Boolean(r.photos?.[0]));
  const fg = heroText(r.color, photoOk);

  const down = (e: RPointerEvent) => {
    if ((e.target as HTMLElement).closest('button')) return;
    start.current = { x: e.clientX, y: e.clientY, id: e.pointerId };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    setDragging(true);
  };
  const move = (e: RPointerEvent) => { if (start.current) setDx(e.clientX - start.current.x); };
  const up = () => {
    if (!start.current) return;
    start.current = null;
    setDragging(false);
    if (dx > 100) onVote('yum'); else if (dx < -100) onVote('nope'); else setDx(0);
  };

  const x = fly ? fly * 600 : dx;
  const tilt = x / 18;
  return (
    <div role="group" aria-roledescription="restaurant card" aria-label={`${r.name}. Swipe right for Yum, left for Nope.`}
      onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={() => { start.current = null; setDragging(false); setDx(0); }}
      className="absolute inset-0 flex touch-none flex-col overflow-hidden rounded-3xl bg-white shadow-[0_18px_40px_rgba(0,0,0,0.18)] select-none"
      style={{ transform: `translateX(${x}px) rotate(${tilt}deg)`, transition: dragging ? 'none' : 'transform 200ms ease' }}>
      <div className="relative flex min-h-0 flex-1 flex-col justify-between overflow-hidden p-[18px]" style={{ background: r.color, color: fg }}>
        <PhotoBackdrop photo={r.photos?.[0]} width={800} onLoadState={setPhotoOk} />
        <div className="relative flex items-center justify-between">
          <span className="text-[13px] font-semibold tracking-[0.2px] opacity-85">{(r.cuisine ?? 'Restaurant').toUpperCase()}{r.price_level ? ` · ${price(r.price_level)}` : ''}</span>
          <button onClick={onDetails} className="flex min-h-11 items-center gap-1 rounded-full px-3 text-[13px] font-semibold" style={{ color: fg }}>
            <span className="flex items-center gap-1 rounded-full px-2.5 py-1" style={{ background: fg === '#FFFFFF' ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.1)' }}><Icon name="info" size={14} sw={2.2} />Details</span>
          </button>
        </div>
        <div className="disp relative text-[clamp(34px,11vw,52px)] leading-[0.95] tracking-[-1.6px] break-words" style={photoOk ? { textShadow: '0 2px 12px rgba(0,0,0,0.35)' } : undefined}>{r.name}</div>
        <div className="pointer-events-none absolute top-14 left-5" style={{ opacity: Math.min(1, Math.max(0, x / 90)) }}><Stamp text="YUM" color="var(--color-brand)" rot={-14} /></div>
        <div className="pointer-events-none absolute top-14 right-5" style={{ opacity: Math.min(1, Math.max(0, -x / 90)) }}><Stamp text="NOPE" color="var(--color-neg)" rot={14} /></div>
      </div>
      <div className="flex flex-none flex-col gap-1 px-[18px] py-3.5 text-[15px]">
        {r.rating != null && <div className="flex items-center gap-1.5"><Icon name="star" size={15} color="#000" sw={1.5} fill="#000" /><b>{r.rating.toFixed(1)}</b>{r.rating_count != null && <span className="text-sec">({r.rating_count.toLocaleString()} reviews)</span>}</div>}
        {meta.dist && <div className="flex items-center gap-1.5"><Icon name="loc" size={15} color="#6D6D72" />{meta.dist} away</div>}
        {meta.hours && <div className="flex items-center gap-1.5"><Icon name="clock" size={15} color="#6D6D72" />Today {meta.hours}</div>}
        {meta.by && <div className="flex items-center gap-1.5 text-[13px] text-sec"><Avatar color={meta.by.color} face={meta.by.face} size={16} />Added by {meta.by.name}</div>}
      </div>
    </div>
  );
}
