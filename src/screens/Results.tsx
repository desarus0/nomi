import { useParty } from '../lib/party';
import { roundsFor } from '../lib/format';
import { POINTS_PER_PICK, type Round } from '../lib/types';
import { Burst, Icon, Mono, PrimaryButton, PuIcon, Screen, TagNext, TagOut } from '../components/ui';

// Fig. 13 – Round results: ranked Yum votes, NEXT/OUT, power-up effects, points earned. Next round starts after 5 s.
export default function Results({ round, nextStartsAt, final }: { round: Round; nextStartsAt?: number; final?: boolean }) {
  const { state, me, now, byId, playerById, inPlay } = useParty();
  const results = state.round_results.filter((r) => r.round_id === round.id).sort((a, b) => b.yums - a.yums || a.rank - b.rank);
  const plays = state.power_ups.filter((p) => p.round_id === round.id);
  const wildcards = state.restaurants.filter((r) => r.is_wildcard && r.wildcard_round === round.number + 1);
  const earned = state.round_points.find((p) => p.round_id === round.id && p.player_id === me.id)?.earned ?? 0;
  const myYumsAdvanced = earned / POINTS_PER_PICK;
  const advanced = results.filter((r) => r.advanced).length;
  const out = results.length - advanced;
  const totalRounds = round.number + roundsFor(inPlay.length);
  const secs = nextStartsAt ? Math.max(0, Math.ceil((nextStartsAt - now) / 1000)) : 0;
  const who = (id: string) => (id === me.id ? 'you' : playerById(id)?.name ?? 'someone');

  const headline = final ? 'And the winner is…' : advanced === 1 ? '1 moves on!' : `${advanced} move on!`;
  const sub = [`${out} knocked out`, wildcards.length ? `${wildcards.length} Wildcard${wildcards.length > 1 ? 's' : ''} join${wildcards.length > 1 ? '' : 's'} Round ${round.number + 1}` : null].filter(Boolean).join(' · ');

  return (
    <Screen footer={
      <div className="flex flex-col gap-4">
        {state.party.powerups_on || earned > 0 ? (
          <div className="relative flex items-center gap-3 rounded-2xl bg-black py-3 pr-[88px] pl-4 text-white">
            <div>
              <div className="text-[17px] font-bold">You earned this round</div>
              <div className="text-[13px] opacity-80">+{POINTS_PER_PICK} for each of your {myYumsAdvanced} pick{myYumsAdvanced === 1 ? '' : 's'} that moved on</div>
            </div>
            <div className="absolute -top-4 right-2"><Burst text={`+${earned}`} size={80} /></div>
          </div>
        ) : null}
        <PrimaryButton disabled aria-live="polite" className="disabled:bg-ink disabled:shadow-[0_5px_0_#4a4a4e]">
          {final ? 'Revealing the winner…' : `Round ${round.number + 1} starts in ${secs}…`}
        </PrimaryButton>
      </div>
    }>
      <div className="px-4 pt-2 text-center">
        <p className="m-0 text-[13px] font-medium text-sec">Round {round.number} of {final ? round.number : totalRounds}</p>
        <h1 className="disp m-0 text-[38px] tracking-[-1.2px]">{headline}</h1>
        <p className="m-0 text-[15px] text-sec">{sub}</p>
      </div>
      <ol className="mx-4 mt-4 mb-4 list-none overflow-hidden rounded-2xl bg-white p-0">
        {results.map((res, i) => {
          const r = byId(res.restaurant_id);
          if (!r) return null;
          const veto = plays.find((p) => p.kind === 'veto' && p.target_restaurant_id === r.id);
          const dbl = res.doubled ? plays.filter((p) => p.kind === 'double') : [];
          const effect = veto
            ? { icon: 'veto' as const, text: `Vetoed by ${who(veto.player_id)} · ${res.raw_yums} Yum${res.raw_yums === 1 ? '' : 's'} cancelled` }
            : dbl.length ? { icon: 'double' as const, text: `Double Vote by ${dbl.map((p) => who(p.player_id)).join(', ')} · +1` } : null;
          return (
            <li key={r.id} className={`flex min-h-[56px] items-center gap-3 px-3.5 py-2 ${i < results.length - 1 || wildcards.length ? 'border-b-[0.5px] border-sep' : ''} ${res.advanced ? '' : 'opacity-60'}`}>
              <Mono name={r.name} color={r.color} size={38} />
              <div className="min-w-0 flex-1">
                <div className={`truncate text-[16px] font-semibold ${res.advanced ? '' : 'line-through'}`}>{r.name}</div>
                {effect && <div className="flex items-center gap-1 text-[12px] text-sec"><PuIcon name={effect.icon} size={14} />{effect.text}</div>}
              </div>
              <span className={`flex items-center gap-1 text-[16px] font-bold tabular-nums ${res.advanced ? 'text-brand' : 'text-sec'}`} aria-label={`${res.yums} Yum votes`}>
                <Icon name="heart" size={14} sw={2.2} fill="currentColor" />{res.yums}
              </span>
              {res.advanced ? <TagNext /> : <TagOut />}
            </li>
          );
        })}
        {wildcards.map((r, i) => {
          const play = plays.find((p) => p.kind === 'wildcard' && p.target_restaurant_id === r.id);
          return (
            <li key={r.id} className={`flex min-h-[56px] items-center gap-3 px-3.5 py-2 ${i < wildcards.length - 1 ? 'border-b-[0.5px] border-sep' : ''}`}>
              <Mono name={r.name} color={r.color} size={38} />
              <div className="min-w-0 flex-1">
                <div className="truncate text-[16px] font-semibold">{r.name}</div>
                <div className="flex items-center gap-1 text-[12px] text-sec"><PuIcon name="sparkle" size={14} />Wildcard by {play ? who(play.player_id) : 'a player'} · added for Round {round.number + 1}</div>
              </div>
              <span className="text-[16px] font-bold text-sec" aria-label="No votes yet">–</span>
              <TagNext />
            </li>
          );
        })}
      </ol>
    </Screen>
  );
}
