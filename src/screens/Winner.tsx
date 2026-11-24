import { useNavigate } from 'react-router-dom';
import { directionsUrl, distanceMiles, fmtMiles, price, travel, onColor } from '../lib/format';
import { useParty } from '../lib/party';
import { Avatar, Icon, Points, PrimaryButton, Screen } from '../components/ui';

// Fig. 14 – Winner: winning restaurant with Directions and Call, final points podium.
const CONFETTI = ['#15803D', '#D4F542', '#8E7CFF', '#3A8EE6', '#D9609B', '#E8833A', '#000'];

export default function Winner() {
  const { state, byId } = useParty();
  const nav = useNavigate();
  const { party, rounds, players } = state;
  const r = byId(party.winner_restaurant_id);
  const first = rounds[0], last = rounds[rounds.length - 1];
  const mins = first && last?.resolved_at ? Math.max(1, Math.round((new Date(last.resolved_at).getTime() - new Date(first.starts_at).getTime()) / 60000)) : null;
  const podium = [...players].sort((a, b) => b.points - a.points).slice(0, 3);
  const mi = r ? distanceMiles(party, r) : null;
  const walk = travel(mi)?.walk;
  const fg = r ? onColor(r.color) : '#fff';

  // Podium order on screen: 2nd, 1st, 3rd
  const order = [podium[1], podium[0], podium[2]];
  const heights = [56, 78, 40];

  return (
    <Screen bg="bg-white" footer={<PrimaryButton onClick={() => nav('/')}>Done</PrimaryButton>}>
      <div aria-hidden="true" className="pointer-events-none fixed inset-0 overflow-hidden">
        {Array.from({ length: 28 }, (_, i) => (
          <span key={i} className="conf" style={{ left: `${(i * 37) % 100}%`, width: 8, height: i % 3 ? 8 : 14, borderRadius: i % 2 ? 2 : 8, background: CONFETTI[i % CONFETTI.length], animationDelay: `${(i * 0.23) % 3.2}s`, animationDuration: `${2.6 + (i % 5) * 0.4}s` }} />
        ))}
      </div>
      <div className="relative px-4 pt-2 text-center">
        <p className="m-0 text-[13px] font-medium text-sec">After {rounds.length} round{rounds.length === 1 ? '' : 's'}{mins ? ` · ${mins} min` : ''}</p>
        <h1 className="disp m-0 text-[40px] tracking-[-1.4px]">We’re eating at…</h1>
      </div>

      {r && (
        <div className="relative mx-4 mt-4 overflow-hidden rounded-[22px] bg-white edge-outline">
          <div className="px-5 pt-4 pb-5" style={{ background: r.color, color: fg }}>
            <div className="flex items-center justify-between">
              <span className="text-[13px] font-semibold tracking-[0.2px] opacity-85">{(r.cuisine ?? 'Restaurant').toUpperCase()}{r.price_level ? ` · ${price(r.price_level)}` : ''}</span>
              <span className="flex items-center gap-1 rounded-full bg-black px-2.5 py-1 text-[11px] font-extrabold tracking-[0.5px] text-white"><Icon name="trophy" size={13} color="#fff" sw={2.2} />WINNER</span>
            </div>
            <h2 className="disp mt-6 mb-0 text-[36px] leading-[1] tracking-[-1.2px]">{r.name}</h2>
          </div>
          <div className="px-4 pt-3 pb-4">
            <p className="m-0 flex flex-wrap items-center gap-1 text-[15px]">
              {r.rating != null && <><Icon name="star" size={15} color="#000" sw={1.5} fill="#000" />{r.rating.toFixed(1)}</>}
              {[fmtMiles(mi), walk].filter(Boolean).map((t) => <span key={t}> · {t}</span>)}
            </p>
            <div className="mt-3 flex gap-2.5">
              <a href={directionsUrl(r)} target="_blank" rel="noreferrer" className="press edge-ink flex h-12 flex-1 items-center justify-center gap-2 rounded-3xl bg-black text-[16px] font-bold text-white">
                <Icon name="directions" size={18} color="#fff" sw={2} />Directions
              </a>
              {r.phone
                ? <a href={`tel:${r.phone}`} className="press flex h-12 flex-1 items-center justify-center gap-2 rounded-3xl bg-fill text-[16px] font-bold"><Icon name="phone" size={18} sw={2} />Call</a>
                : <span className="flex h-12 flex-1 items-center justify-center rounded-3xl bg-fill text-[14px] text-sec">No phone listed</span>}
            </div>
          </div>
        </div>
      )}

      {party.powerups_on && podium.length > 0 && (
        <section className="relative px-4 pt-6 pb-4" aria-label="Final points">
          <p className="mb-2 ml-1 text-[13px] text-sec uppercase">Final points</p>
          <ol className="m-0 flex list-none items-end justify-center gap-2 p-0">
            {order.map((p, i) => p && (
              <li key={p.id} className="flex w-[100px] flex-col items-center gap-1" aria-label={`${[2, 1, 3][i]}${['nd', 'st', 'rd'][i]} place: ${p.name}, ${p.points} points`}>
                <Avatar color={p.color} face={p.face} size={i === 1 ? 52 : 40} host={p.id === party.host_player_id} />
                <span className="text-[15px] font-semibold">{p.name}</span>
                <Points n={p.points} />
                <span className={`disp mt-1 grid w-full place-items-center rounded-t-lg text-[28px] ${i === 1 ? 'bg-black text-white' : 'bg-white edge-outline'}`} style={{ height: heights[i] }}>{[2, 1, 3][i]}</span>
              </li>
            ))}
          </ol>
          <p className="mt-3 text-center text-[15px] font-semibold">{podium[0].name} wins with {podium[0].points} points</p>
        </section>
      )}
    </Screen>
  );
}
