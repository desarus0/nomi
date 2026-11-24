import { useParty } from '../lib/party';
import { Burst, Centered } from '../components/ui';
import Lobby from './Lobby';
import Swipe from './Swipe';
import Waiting from './Waiting';
import Results from './Results';
import Winner from './Winner';

/** Picks the screen for the party's current phase. Every client derives it from the same server state + clock. */
export default function PartyHome() {
  const { state, round, now, me, inPlay } = useParty();
  const { party, rounds, my_votes } = state;

  if (party.status === 'lobby') return <Lobby />;

  if (party.status === 'finished') {
    const last = rounds[rounds.length - 1];
    // Show the final round's results for 5 s, then the winner.
    if (last?.resolved_at && now < new Date(last.resolved_at).getTime() + 5000) return <Results round={last} final />;
    return <Winner />;
  }

  if (!round) return <Centered>Loading round…</Centered>;
  const startsAt = new Date(round.starts_at).getTime();

  if (now < startsAt) {
    const prev = rounds.find((r) => r.number === round.number - 1);
    if (prev) return <Results round={prev} nextStartsAt={startsAt} />;
    const s = Math.ceil((startsAt - now) / 1000);
    return (
      <Centered>
        <p className="m-0 text-[15px] font-semibold text-sec">Round 1 · {inPlay.length} restaurants</p>
        <h1 className="disp m-0 text-[44px] tracking-[-1.4px]">Get ready to swipe</h1>
        <Burst text={String(s)} size={110} />
        <p className="m-0 text-sec">Right for Yum, left for Nope.</p>
      </Centered>
    );
  }

  if (round.status === 'resolved') return <Results round={round} />;

  const voted = new Set(my_votes.map((v) => v.restaurant_id));
  const done = me.done_round >= round.number || inPlay.every((r) => voted.has(r.id));
  return done ? <Waiting /> : <Swipe />;
}
