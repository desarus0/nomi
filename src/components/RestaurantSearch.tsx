import { useEffect, useState } from 'react';
import { searchRestaurants } from '../lib/api';
import { metaLine } from '../lib/format';
import type { Party, PlaceResult } from '../lib/types';
import { Icon, Mono, Row, Spinner } from './ui';

/** Debounced Places search. `mode="add"` shows + buttons (Pool); `mode="pick"` shows radio circles (Wildcard). */
export function RestaurantSearch({ party, takenPlaceIds, onAdd, mode, selectedId, autoFocus, placeholder = 'Search restaurants by name' }: {
  party: Pick<Party, 'lat' | 'lng'>;
  takenPlaceIds: Set<string>;
  onAdd: (r: PlaceResult) => void | Promise<void>;
  mode: 'add' | 'pick';
  selectedId?: string | null;
  autoFocus?: boolean;
  placeholder?: string;
}) {
  const [q, setQ] = useState('');
  const [results, setResults] = useState<PlaceResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState<string | null>(null);

  useEffect(() => {
    if (q.trim().length < 2) { setResults([]); setError(null); return; }
    const ctl = new AbortController();
    const t = setTimeout(() => {
      setLoading(true);
      searchRestaurants(q, party.lat, party.lng, ctl.signal)
        .then((r) => { setResults(r); setError(null); })
        .catch((e) => { if ((e as Error).name !== 'AbortError') setError((e as Error).message); })
        .finally(() => setLoading(false));
    }, 300);
    return () => { clearTimeout(t); ctl.abort(); };
  }, [q, party.lat, party.lng]);

  async function add(r: PlaceResult) {
    setAdding(r.place_id);
    try { await onAdd(r); } finally { setAdding(null); }
  }

  return (
    <div>
      <label className="flex h-[46px] items-center gap-2 rounded-xl bg-white px-3 focus-within:shadow-[inset_0_0_0_2px_var(--color-brand)]">
        <Icon name="search" size={18} color="#6D6D72" />
        <span className="sr-only">Search restaurants</span>
        <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={placeholder} autoFocus={autoFocus}
          autoComplete="off" enterKeyHint="search" className="h-full flex-1 bg-transparent text-[17px] outline-none placeholder:text-[#8E8E93]" />
        {loading && <Spinner />}
      </label>
      {error && <p role="alert" className="mx-1 mt-2 text-[13px] text-neg">{error}</p>}
      {results.length > 0 && (
        <div className="mt-2 overflow-hidden rounded-xl bg-white" aria-live="polite">
          {results.map((r, i) => {
            const taken = takenPlaceIds.has(r.place_id);
            const selected = selectedId === r.place_id;
            const last = i === results.length - 1;
            const meta = metaLine(party, r) + (taken ? ' · already added' : '');
            if (mode === 'pick') {
              return (
                <Row key={r.place_id} last={last} dim={taken} onClick={taken ? undefined : () => add(r)}
                  lead={<Mono name={r.name} color="#8C6E9E" />} title={r.name} sub={meta}
                  trail={selected
                    ? <span className="grid h-6 w-6 place-items-center rounded-full bg-brand"><Icon name="check" size={14} color="#fff" sw={3} /></span>
                    : <span className="h-6 w-6 rounded-full border-2 border-[#C7C7CC]" />} />
              );
            }
            return (
              <Row key={r.place_id} last={last} dim={taken}
                lead={<Mono name={r.name} color="#3F4A5A" />} title={r.name} sub={meta}
                trail={taken
                  ? <Icon name="check" size={20} color="var(--color-sec)" />
                  : <button onClick={() => add(r)} disabled={adding !== null} aria-label={`Add ${r.name}`} className="grid h-11 w-11 place-items-center">
                      <span className="grid h-7 w-7 place-items-center rounded-full bg-brand">{adding === r.place_id ? <Spinner /> : <Icon name="plus" size={16} color="#fff" sw={2.8} />}</span>
                    </button>} />
            );
          })}
        </div>
      )}
      {!loading && !error && q.trim().length >= 2 && results.length === 0 && <p className="mx-1 mt-2 text-[13px] text-sec">No restaurants found.</p>}
    </div>
  );
}
