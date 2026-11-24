import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { ago, roundsFor } from '../lib/format';
import { useParty } from '../lib/party';
import { POWER_UPS } from '../lib/types';
import { Avatar, Icon, OkBadge, Points, PuIcon, Screen, ThinkBubble } from '../components/ui';

// Fig. 12 – Waiting for others: who is done, time left, live feed of power-ups played.
export default function Waiting() {
  const { state, me, round, now, activePlayers, inPlay, playerById } = useParty();
  const nav = useNavigate();
  const { party } = state;
  if (!round) return null;
  const n = round.number;
  const done = activePlayers.filter((p) => p.done_round >= n || p.id === me.id);
  const waitingOn = activePlayers.length - done.length;
  const secs = Math.max(0, Math.ceil((new Date(round.ends_at).getTime() - now) / 1000));
  const totalRounds = party.current_round - 1 + roundsFor(inPlay.length);

  const plays = state.power_ups.filter((p) => p.round_id === round.id).map((p) => ({ kind: 'pu' as const, p, at: p.created_at }));
  const feed = [...plays].sort((a, b) => b.at.localeCompare(a.at));

  async function leave() {
    if (!confirm('Leave the game? You won’t be able to rejoin this party.')) return;
    await api.leave(party.id).catch(() => {});
    nav('/', { replace: true });
  }

  return (
    <Screen>
      <header className="flex items-center justify-between px-5 pt-1.5">
        <div>
          <div className="text-[13px] font-medium text-sec">Round {n} of {totalRounds}</div>
          <div className="disp text-[20px]">You’re done!</div>
        </div>
        <span className="disp -rotate-3 rounded-[10px] bg-black px-2.5 py-0.5 text-[20px] text-white" aria-label={`${done.length} of ${activePlayers.length} players finished`}>{done.length}/{activePlayers.length} in</span>
        <Points n={me.points} />
      </header>

      <div className="mx-4 mt-4 rounded-2xl bg-white p-4" aria-live="polite">
        <div className="flex items-baseline justify-between">
          <h1 className="m-0 text-[17px] font-semibold">{waitingOn === 0 ? 'Everyone’s in!' : `Waiting on ${waitingOn} friend${waitingOn === 1 ? '' : 's'}`}</h1>
          <span role="timer" className="disp text-[22px] tabular-nums">{Math.floor(secs / 60)}:{String(secs % 60).padStart(2, '0')}</span>
        </div>
        <div className="mt-2 h-2 overflow-hidden rounded bg-fill" aria-hidden="true">
          <div className="h-full rounded bg-black transition-[width]" style={{ width: `${(done.length / Math.max(1, activePlayers.length)) * 100}%` }} />
        </div>
        <p className="mt-2 mb-3 text-[13px] text-sec">{done.length} of {activePlayers.length} finished · results appear when everyone is done or time runs out</p>
        <ul className="m-0 flex list-none flex-wrap justify-around gap-y-3 p-0">
          {activePlayers.map((p) => {
            const isDone = p.done_round >= n || p.id === me.id;
            return (
              <li key={p.id} className="flex w-[64px] flex-col items-center">
                <div className="relative">
                  <Avatar color={p.color} face={p.face} size={44} className={isDone ? '' : 'bob'} badge={isDone ? <OkBadge /> : undefined} />
                  {!isDone && <ThinkBubble />}
                </div>
                <span className="mt-1 max-w-full truncate text-[13px] font-semibold">{p.id === me.id ? 'You' : p.name}</span>
                <span className={`text-[11px] ${isDone ? 'font-semibold text-brand' : 'text-sec'}`}>{isDone ? 'Done' : 'Voting…'}</span>
              </li>
            );
          })}
        </ul>
      </div>

      <p className="mx-8 mt-6 mb-1.5 text-[13px] text-sec uppercase">Live feed</p>
      <div className="mx-4 overflow-hidden rounded-xl bg-white" aria-live="polite">
        {feed.length === 0 && <p className="m-0 px-4 py-3 text-[15px] text-sec">No power-ups played yet this round.</p>}
        {feed.map(({ p }, i) => {
          const who = p.player_id === me.id ? 'You' : playerById(p.player_id)?.name ?? 'Someone';
          return (
            <div key={p.id} className={`flex min-h-[54px] items-center gap-3 px-4 ${i < feed.length - 1 ? 'border-b-[0.5px] border-sep' : ''}`}>
              <PuIcon name={POWER_UPS[p.kind].icon} size={30} />
              <span className="flex-1 text-[15px]"><b>{who}</b> played {POWER_UPS[p.kind].name}</span>
              <span className="text-[13px] text-sec">{ago(p.created_at, now)}</span>
            </div>
          );
        })}
        {activePlayers.filter((p) => p.done_round >= n && p.id !== me.id).map((p) => (
          <div key={p.id} className="flex min-h-[54px] items-center gap-3 border-t-[0.5px] border-sep px-4">
            <span className="grid h-[30px] w-[30px] place-items-center"><Icon name="check" size={20} color="var(--color-brand)" sw={2.6} /></span>
            <span className="flex-1 text-[15px]"><b>{p.name}</b> finished swiping</span>
          </div>
        ))}
      </div>
      <p className="mx-8 mt-2 text-[13px] text-sec">Power-up targets stay hidden until the round results.</p>
      <div className="flex justify-center pb-6"><button onClick={leave} className="min-h-11 px-3 text-[15px] text-neg">Leave game</button></div>
    </Screen>
  );
}
