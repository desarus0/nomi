import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { api } from './api';
import { ensureSession, supabase } from './supabase';
import type { PartyState, Player, Restaurant, Round } from './types';

interface PartyCtx {
  state: PartyState;
  refresh: () => Promise<void>;
  /** Server-synced clock in ms, updated 4×/s. */
  now: number;
  me: Player;
  isHost: boolean;
  activePlayers: Player[];
  inPlay: Restaurant[];
  round: Round | null;
  byId: (id: string | null | undefined) => Restaurant | undefined;
  playerById: (id: string | null | undefined) => Player | undefined;
}

const Ctx = createContext<PartyCtx | null>(null);

/** For screens used both inside and outside a party (Settings in create mode). */
export function useMaybeParty() {
  return useContext(Ctx);
}

export function useParty() {
  const c = useContext(Ctx);
  if (!c) throw new Error('useParty outside PartyProvider');
  return c;
}

type Load = { kind: 'loading' } | { kind: 'error'; message: string } | { kind: 'ready'; state: PartyState };

export function PartyProvider({ partyId, children, fallback }: {
  partyId: string; children: ReactNode; fallback: (s: { error?: string }) => ReactNode;
}) {
  const [load, setLoad] = useState<Load>({ kind: 'loading' });
  const offset = useRef(0);
  const [now, setNow] = useState(Date.now());
  const inflight = useRef<Promise<void> | null>(null);
  const again = useRef(false);

  const refresh = useCallback(async () => {
    // Coalesce bursts of realtime pings into at most one queued refetch.
    if (inflight.current) { again.current = true; return inflight.current; }
    inflight.current = (async () => {
      try {
        do {
          again.current = false;
          const t0 = Date.now();
          const s = await api.getState(partyId);
          offset.current = new Date(s.now).getTime() - (t0 + Date.now()) / 2;
          setLoad({ kind: 'ready', state: s });
        } while (again.current);
      } catch (e) {
        setLoad((prev) => (prev.kind === 'ready' ? prev : { kind: 'error', message: (e as Error).message }));
      } finally {
        inflight.current = null;
      }
    })();
    return inflight.current;
  }, [partyId]);

  // Initial load + Realtime subscription on the party row (its `rev` bumps on every change).
  useEffect(() => {
    let cancelled = false;
    let channel: ReturnType<typeof supabase.channel> | null = null;
    ensureSession().then(async () => {
      if (cancelled) return;
      const { data } = await supabase.auth.getSession();
      if (data.session) supabase.realtime.setAuth(data.session.access_token);
      channel = supabase
        .channel(`party:${partyId}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'parties', filter: `id=eq.${partyId}` }, () => refresh())
        .subscribe((status) => { if (status === 'SUBSCRIBED') refresh(); });
      refresh();
    }).catch((e) => setLoad({ kind: 'error', message: (e as Error).message }));
    return () => { cancelled = true; if (channel) supabase.removeChannel(channel); };
  }, [partyId, refresh]);

  const status = load.kind === 'ready' ? load.state.party.status : null;

  // Fallback polling in case a Realtime message is missed (faster while playing).
  useEffect(() => {
    const ms = status === 'playing' ? 3000 : 6000;
    const id = setInterval(() => { if (document.visibilityState === 'visible') refresh(); }, ms);
    const onVis = () => { if (document.visibilityState === 'visible') refresh(); };
    document.addEventListener('visibilitychange', onVis);
    return () => { clearInterval(id); document.removeEventListener('visibilitychange', onVis); };
  }, [refresh, status]);

  // Server-synced clock.
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now() + offset.current), 250);
    return () => clearInterval(id);
  }, []);

  // When the round deadline passes, ask the server to resolve it (idempotent; any client may do it).
  const lastTick = useRef(0);
  const round = load.kind === 'ready' ? load.state.rounds.find((r) => r.number === load.state.party.current_round) ?? null : null;
  useEffect(() => {
    if (status !== 'playing' || !round || round.status !== 'voting') return;
    if (now < new Date(round.ends_at).getTime()) return;
    if (Date.now() - lastTick.current < 2000) return;
    lastTick.current = Date.now();
    api.tick(partyId).then(refresh).catch(() => {});
  }, [now, round, status, partyId, refresh]);

  const value = useMemo<PartyCtx | null>(() => {
    if (load.kind !== 'ready') return null;
    const s = load.state;
    const me = s.players.find((p) => p.id === s.me)!;
    const rmap = new Map(s.restaurants.map((r) => [r.id, r]));
    const pmap = new Map(s.players.map((p) => [p.id, p]));
    return {
      state: s, refresh, now, me,
      isHost: s.party.host_player_id === s.me,
      activePlayers: s.players.filter((p) => !p.left_at),
      inPlay: s.restaurants.filter((r) => r.in_play),
      round,
      byId: (id) => (id ? rmap.get(id) : undefined),
      playerById: (id) => (id ? pmap.get(id) : undefined),
    };
  }, [load, refresh, now, round]);

  if (load.kind === 'loading') return <>{fallback({})}</>;
  if (load.kind === 'error') return <>{fallback({ error: load.message })}</>;
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
