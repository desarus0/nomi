import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../lib/api';
import { metaLine } from '../lib/format';
import { useParty } from '../lib/party';
import { POOL_MAX, POOL_MIN } from '../lib/types';
import { RestaurantSearch } from '../components/RestaurantSearch';
import { Avatar, BackLink, ErrorText, Icon, Mono, NavBar, PrimaryButton, Row, Screen, Section } from '../components/ui';

// Fig. 6 – Restaurant pool (FR01): search and add restaurants, remove them, 4–16 limit.
export default function Pool() {
  const { state, refresh, playerById } = useParty();
  const nav = useNavigate();
  const [params] = useSearchParams();
  const [showAll, setShowAll] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { party, restaurants } = state;
  const lobby = `/p/${party.code}`;
  const locked = party.status !== 'lobby';
  const full = restaurants.length >= POOL_MAX;
  const taken = new Set(restaurants.map((r) => r.place_id));
  const visible = showAll ? restaurants : restaurants.slice(0, 5);

  async function add(r: Parameters<typeof api.addRestaurant>[1]) {
    setError(null);
    try { await api.addRestaurant(party.id, r); await refresh(); } catch (e) { setError((e as Error).message); }
  }
  async function remove(id: string) {
    setError(null);
    try { await api.removeRestaurant(id); await refresh(); } catch (e) { setError((e as Error).message); }
  }

  return (
    <Screen footer={<PrimaryButton onClick={() => nav(lobby)}>{params.get('setup') ? 'Done' : 'Back to Lobby'}</PrimaryButton>}>
      <NavBar title="Restaurant Pool" left={<BackLink to={lobby} label="Lobby" />} />
      <div className="flex flex-col gap-4 px-4 pt-2 pb-4">
        {locked ? <p className="text-sec">The pool is locked once voting starts.</p>
          : full ? <p className="rounded-xl bg-white p-3 text-[15px] text-sec">The pool is full ({POOL_MAX} max). Remove one to add another.</p>
          : <RestaurantSearch party={party} takenPlaceIds={taken} onAdd={add} mode="add" autoFocus={restaurants.length === 0} />}
        <ErrorText>{error}</ErrorText>

        <div className="rounded-xl bg-white px-3 py-3">
          <div className="flex items-baseline justify-between">
            <span className="text-[15px] font-semibold">{restaurants.length} restaurant{restaurants.length === 1 ? '' : 's'}</span>
            <span className={`text-[13px] ${restaurants.length < POOL_MIN ? 'font-semibold text-neg' : 'text-sec'}`}>{POOL_MIN} minimum · {POOL_MAX} maximum</span>
          </div>
          <div className="mt-2.5 grid grid-cols-8 gap-[7px]" aria-hidden="true">
            {Array.from({ length: Math.max(8, Math.min(POOL_MAX, Math.ceil((restaurants.length + 1) / 8) * 8)) }, (_, i) => {
              const r = restaurants[i];
              return r ? <Mono key={i} name={r.name} color={r.color} size={30} radius={7} fontSize={10} />
                : <span key={i} className={`h-[30px] rounded-[7px] border-[1.5px] ${i < POOL_MIN ? 'border-[#8E8E93] border-dashed' : 'border-[#D1D1D6]'}`} />;
            })}
          </div>
        </div>

        {restaurants.length > 0 && (
          <Section header="Added by the party">
            {visible.map((r, i) => {
              const by = playerById(r.added_by);
              return (
                <Row key={r.id} last={i === visible.length - 1 && restaurants.length <= 5}
                  lead={<Mono name={r.name} color={r.color} />} title={r.name} sub={metaLine(party, r)}
                  trail={<div className="flex items-center gap-1">
                    {by && <span title={`Added by ${by.name}`}><Avatar color={by.color} face={by.face} size={24} /><span className="sr-only">Added by {by.name}</span></span>}
                    {!locked && <button onClick={() => remove(r.id)} aria-label={`Remove ${r.name}`} className="grid h-11 w-11 place-items-center"><Icon name="x" size={16} color="#8E8E93" sw={2.4} /></button>}
                  </div>} />
              );
            })}
            {restaurants.length > 5 && (
              <button className="min-h-11 w-full px-4 text-left text-[17px] text-brand" onClick={() => setShowAll(!showAll)}>
                {showAll ? 'Show Less' : `Show ${restaurants.length - 5} More`}
              </button>
            )}
          </Section>
        )}
      </div>
    </Screen>
  );
}
