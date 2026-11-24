import type { ReactNode } from 'react';
import { distanceMiles, fmtMiles, mapsUrl, onColor, price, todayHours, travel } from '../../lib/format';
import { useParty } from '../../lib/party';
import type { Choice, Restaurant } from '../../lib/types';
import { Avatar, Icon, Sheet, CloseButton } from '../../components/ui';

// Fig. 8 – Restaurant details: address, map link, hours, travel time; vote from here.
export function DetailsSheet({ r, onClose, onVote }: { r: Restaurant; onClose: () => void; onVote: (c: Choice) => void }) {
  const { state, playerById } = useParty();
  const mi = distanceMiles(state.party, r);
  const t = travel(mi);
  const hours = todayHours(r);
  const by = playerById(r.added_by);
  const fg = onColor(r.color);

  const line = (icon: Parameters<typeof Icon>[0]['name'], main: ReactNode, sub?: string, trail?: ReactNode) => (
    <div className="relative flex min-h-[54px] items-center gap-3 px-4 py-2 after:absolute after:right-0 after:bottom-0 after:left-[60px] after:h-[0.5px] after:bg-sep last:after:hidden">
      <span className="grid h-8 w-8 flex-none place-items-center rounded-lg bg-black"><Icon name={icon} size={17} color="#fff" /></span>
      <div className="min-w-0 flex-1"><div className="text-[17px] tracking-[-0.4px]">{main}</div>{sub && <div className="text-[13px] text-sec">{sub}</div>}</div>
      {trail}
    </div>
  );

  return (
    <Sheet onClose={onClose} label={`${r.name} details`}>
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-0 mt-2 rounded-t-xl px-5 pt-3 pb-5" style={{ background: r.color, color: fg }}>
          <div className="flex items-center justify-between">
            <span className="text-[13px] font-semibold tracking-[0.2px] opacity-85">{(r.cuisine ?? 'Restaurant').toUpperCase()}{r.price_level ? ` · ${price(r.price_level)}` : ''}</span>
            <CloseButton onClick={onClose} />
          </div>
          <h2 className="disp m-0 text-[40px] leading-[1] tracking-[-1.2px]">{r.name}</h2>
          {r.rating != null && <p className="mt-2 mb-0 flex items-center gap-1 text-[15px]"><Icon name="star" size={15} color={fg} sw={1.5} fill={fg} /><b>{r.rating.toFixed(1)}</b>{r.rating_count != null && <span className="opacity-85"> · {r.rating_count.toLocaleString()} reviews</span>}</p>}
        </div>
        <div className="mx-4 mt-4 overflow-hidden rounded-xl bg-white">
          {line('loc', r.address ?? 'Address unavailable', fmtMiles(mi) ? `${fmtMiles(mi)} away` : undefined,
            <a href={mapsUrl(r)} target="_blank" rel="noreferrer" className="min-h-11 px-1 py-3 text-[15px]">Map</a>)}
          {hours && line('clock', <span><span className="font-semibold text-brand">Today</span> · {hours}</span>)}
          {t && line('walk', t.walk ?? t.drive, t.walk ? t.drive : undefined)}
          {r.phone && line('phone', <a href={`tel:${r.phone}`}>{r.phone}</a>)}
        </div>
        {r.summary && (
          <>
            <p className="mx-8 mt-5 mb-1.5 text-[13px] text-sec uppercase">About</p>
            <p className="mx-4 mt-0 rounded-xl bg-white px-4 py-3 text-[15px] leading-[21px]">{r.summary}</p>
          </>
        )}
        <div className="mx-5 mt-3 flex h-[120px] items-center justify-center rounded-xl border-2 border-dashed border-[#D1D1D6] text-[13px] text-sec">Photos coming soon</div>
        {by && <p className="mx-5 mt-3 mb-4 flex items-center gap-1.5 text-[13px] text-sec"><Avatar color={by.color} face={by.face} size={16} />Added to the pool by {by.name}</p>}
      </div>
      <div className="flex flex-none gap-3 px-4 pt-3">
        <button onClick={() => onVote('nope')} className="press flex h-[54px] flex-1 items-center justify-center gap-1.5 rounded-[27px] border-2 border-neg bg-white text-[17px] font-bold text-neg"><Icon name="x" size={18} sw={3} />Nope</button>
        <button onClick={() => onVote('yum')} className="press edge-brand flex h-[54px] flex-1 items-center justify-center gap-1.5 rounded-[27px] bg-brand text-[17px] font-bold text-white"><Icon name="heart" size={18} sw={2.4} fill="#fff" />Yum</button>
      </div>
    </Sheet>
  );
}
