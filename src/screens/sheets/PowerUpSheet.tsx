import { useState } from 'react';
import { api } from '../../lib/api';
import { metaLine } from '../../lib/format';
import { useParty } from '../../lib/party';
import { POWER_UPS, type PlaceResult, type PowerUpKind } from '../../lib/types';
import { RestaurantSearch } from '../../components/RestaurantSearch';
import { BackLink, ErrorText, Icon, Mono, Points, PrimaryButton, PuIcon, Row, Sheet, SheetHead } from '../../components/ui';

// Figs. 9–11 – Power-ups (pick a move), Veto (choose target), Wildcard (add restaurant).
// Points are only spent when the player confirms; the confirm step shows points before → after.
export function PowerUpSheet({ onClose }: { onClose: () => void }) {
  const { state, me, round, inPlay, refresh } = useParty();
  const [kind, setKind] = useState<PowerUpKind | null>(null);
  const [step, setStep] = useState<'pick' | 'target'>('pick');
  const [target, setTarget] = useState<string | null>(null);
  const [wild, setWild] = useState<PlaceResult | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const played = state.power_ups.find((p) => p.round_id === round?.id && p.player_id === me.id);
  const finalRound = inPlay.length <= 2;

  function unavailable(k: PowerUpKind): string | null {
    if (played) return 'One per round';
    if (me.points < POWER_UPS[k].cost) return 'Not enough points';
    if (k === 'wildcard' && finalRound) return 'Not in the final round';
    if (k === 'double' && state.my_double_pending) return 'Already active';
    return null;
  }

  async function confirm() {
    if (!kind) return;
    setBusy(true); setError(null);
    try {
      await api.playPowerUp(state.party.id, kind, kind === 'veto' ? target : null, kind === 'wildcard' ? wild : null);
      await refresh();
      onClose();
    } catch (e) { setError((e as Error).message); setBusy(false); }
  }

  if (played) {
    const pu = POWER_UPS[played.kind];
    return (
      <Sheet onClose={onClose} label="Power-ups">
        <SheetHead title="Power-up played" onClose={onClose} />
        <div className="flex items-center gap-3 px-4 py-6">
          <PuIcon name={pu.icon} size={48} />
          <p className="m-0 text-[17px]">You played <b>{pu.name}</b> this round. You can play another next round.</p>
        </div>
      </Sheet>
    );
  }

  const cost = kind ? POWER_UPS[kind].cost : 0;
  const after = (
    <div className="flex items-center justify-between rounded-xl bg-white px-4 py-3">
      <span className="text-[15px]">Your points after</span>
      <span className="flex items-center gap-2"><s className="text-[15px] text-sec">{me.points}</s><Icon name="chev" size={14} color="#8E8E93" sw={2.4} /><Points n={me.points - cost} /></span>
    </div>
  );

  // ---------------- step 1: pick your move (Fig. 9)
  if (step === 'pick') {
    return (
      <Sheet onClose={onClose} label="Power-ups">
        <SheetHead title="Pick your move" onClose={onClose} right={<Points n={me.points} suffix=" pts" />} />
        <p className="mx-4 mt-1 mb-3 text-[15px] text-sec">One per round. Others see who played it when the round ends.</p>
        <div role="radiogroup" aria-label="Power-ups" className="flex flex-col gap-2.5 overflow-y-auto px-4">
          {(Object.keys(POWER_UPS) as PowerUpKind[]).map((k) => {
            const pu = POWER_UPS[k];
            const why = unavailable(k);
            const sel = kind === k;
            return (
              <button key={k} role="radio" aria-checked={sel} disabled={!!why} onClick={() => setKind(k)}
                className={`flex items-center gap-3 rounded-2xl bg-white p-3.5 text-left disabled:opacity-45 ${sel ? 'shadow-[inset_0_0_0_2.5px_var(--color-brand),0_4px_0_var(--color-brand)]' : ''}`}>
                <PuIcon name={pu.icon} size={44} />
                <span className="flex-1">
                  <span className="block text-[17px] font-semibold">{pu.name}</span>
                  <span className="block text-[13px] text-sec">{why ?? pu.effect}</span>
                </span>
                <Points n={pu.cost} />
                {sel ? <span className="grid h-6 w-6 place-items-center rounded-full bg-brand"><Icon name="check" size={14} color="#fff" sw={3} /></span>
                  : <span className="h-6 w-6 rounded-full border-2 border-[#C7C7CC]" />}
              </button>
            );
          })}
          {kind === 'double' && after}
        </div>
        <ErrorText>{error}</ErrorText>
        <div className="px-4 pt-5">
          {kind === 'double'
            ? <PrimaryButton disabled={busy} onClick={confirm}>{busy ? 'Playing…' : `Play Double Vote · ${cost} pts`}</PrimaryButton>
            : <PrimaryButton disabled={!kind} onClick={() => setStep('target')}>Next: Choose a Target</PrimaryButton>}
          <p className="mt-2.5 mb-0 text-center text-[13px] text-sec">No points are spent until you confirm.</p>
        </div>
      </Sheet>
    );
  }

  const back = <BackLink label="Power-ups" onClick={() => { setStep('pick'); setError(null); }} />;

  // ---------------- step 2a: Veto target (Fig. 10)
  if (kind === 'veto') {
    const list = showAll ? inPlay : inPlay.slice(0, 5);
    const t = inPlay.find((r) => r.id === target);
    return (
      <Sheet onClose={onClose} label="Veto which restaurant?">
        <SheetHead back={back} title={<span className="flex items-center gap-3"><PuIcon name="veto" size={40} />Veto which restaurant?</span>} onClose={onClose} />
        <p className="mx-4 mt-1 mb-3 text-[15px] text-sec">All its Yum votes this round are cancelled.</p>
        <div className="min-h-0 flex-1 overflow-y-auto px-4">
          <p className="mx-4 mt-0 mb-1.5 text-[13px] text-sec uppercase">Still in round {state.party.current_round}</p>
          <div role="radiogroup" aria-label="Restaurants" className="overflow-hidden rounded-xl bg-white">
            {list.map((r, i) => (
              <Row key={r.id} onClick={() => setTarget(r.id)} last={i === list.length - 1 && inPlay.length <= 5}
                lead={<Mono name={r.name} color={r.color} />} title={r.name} sub={metaLine(state.party, r)}
                trail={<span role="radio" aria-checked={target === r.id} aria-label={r.name}>{target === r.id
                  ? <span className="grid h-6 w-6 place-items-center rounded-full bg-brand"><Icon name="check" size={14} color="#fff" sw={3} /></span>
                  : <span className="block h-6 w-6 rounded-full border-2 border-[#C7C7CC]" />}</span>} />
            ))}
            {inPlay.length > 5 && <button className="min-h-11 w-full px-4 text-left text-[17px] text-brand" onClick={() => setShowAll(!showAll)}>{showAll ? 'Show Less' : `Show ${inPlay.length - 5} More`}</button>}
          </div>
          <div className="mt-4">{after}</div>
        </div>
        <ErrorText>{error}</ErrorText>
        <div className="px-4 pt-4">
          <PrimaryButton disabled={!t || busy} onClick={confirm}>{busy ? 'Playing…' : t ? `Veto ${t.name} · ${cost} pts` : 'Pick a restaurant'}</PrimaryButton>
        </div>
      </Sheet>
    );
  }

  // ---------------- step 2b: Wildcard (Fig. 11)
  const taken = new Set(state.restaurants.map((r) => r.place_id));
  return (
    <Sheet onClose={onClose} label="Play a Wildcard">
      <SheetHead back={back} title={<span className="flex items-center gap-3"><PuIcon name="sparkle" size={40} />Play a Wildcard</span>} onClose={onClose} />
      <p className="mx-4 mt-1 mb-3 text-[15px] text-sec">Pick a restaurant to add to Round {state.party.current_round + 1}.</p>
      <div className="min-h-0 flex-1 overflow-y-auto px-4">
        <RestaurantSearch party={state.party} takenPlaceIds={taken} mode="pick" selectedId={wild?.place_id} onAdd={setWild} autoFocus placeholder="Search for a new restaurant" />
        <p className="mx-1 mt-2 text-[13px] text-sec">Restaurants already in the party can’t be picked.</p>
        <div className="mt-4">{after}</div>
      </div>
      <ErrorText>{error}</ErrorText>
      <div className="px-4 pt-4">
        <PrimaryButton disabled={!wild || busy} onClick={confirm}>{busy ? 'Playing…' : wild ? `Add ${wild.name} · ${cost} pts` : 'Pick a restaurant'}</PrimaryButton>
      </div>
    </Sheet>
  );
}
