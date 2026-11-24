import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { roundsFor } from '../lib/format';
import { useMaybeParty } from '../lib/party';
import { BackLink, ErrorText, Icon, NavBar, Points, PrimaryButton, PuIcon, Row, Screen, Section, Stepper, Toggle } from '../components/ui';

// Fig. 5 – Party settings (host). Used to create a party (/new) and to edit it from the lobby.
const NAME_KEY = 'nomi-name';
type Loc = { lat: number; lng: number; label: string } | null;

export default function Settings() {
  const ctx = useMaybeParty();
  const nav = useNavigate();
  const editing = Boolean(ctx);
  const p = ctx?.state.party;
  const lobby = p ? `/p/${p.code}` : '/';

  const [name, setName] = useState(() => localStorage.getItem(NAME_KEY) ?? '');
  const [loc, setLoc] = useState<Loc>(p?.lat != null && p.lng != null ? { lat: p.lat, lng: p.lng, label: p.location_label ?? 'Current location' } : null);
  const [locState, setLocState] = useState<'idle' | 'finding' | 'denied'>('idle');
  const [timePerCard, setTimePerCard] = useState(p?.time_per_card ?? 20);
  const [powerupsOn, setPowerupsOn] = useState(p?.powerups_on ?? true);
  const [startingPoints, setStartingPoints] = useState(p?.starting_points ?? 60);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function findMe() {
    if (!navigator.geolocation) { setLocState('denied'); return; }
    setLocState('finding');
    navigator.geolocation.getCurrentPosition(
      (pos) => { setLoc({ lat: pos.coords.latitude, lng: pos.coords.longitude, label: 'Current location' }); setLocState('idle'); },
      () => setLocState('denied'),
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 },
    );
  }
  // "Current location" is the default for a new party.
  useEffect(() => { if (!editing) findMe(); }, [editing]);

  if (ctx && !ctx.isHost) {
    return <Screen><NavBar title="Party Settings" left={<BackLink to={lobby} label="Lobby" />} /><p className="p-4 text-sec">Only the host can change settings.</p></Screen>;
  }

  const pool = ctx ? ctx.state.restaurants.length : 0;
  const rounds = roundsFor(Math.max(pool, 4));

  async function save() {
    setBusy(true); setError(null);
    const settings = { lat: loc?.lat ?? null, lng: loc?.lng ?? null, label: loc?.label ?? null, timePerCard, powerupsOn, startingPoints };
    try {
      if (ctx) {
        await api.updateSettings(ctx.state.party.id, settings);
        await ctx.refresh();
        nav(lobby);
      } else {
        localStorage.setItem(NAME_KEY, name.trim());
        const { party_id, code } = await api.createParty(name.trim());
        await api.updateSettings(party_id, settings);
        nav(`/p/${code}/pool?setup=1`, { replace: true });
      }
    } catch (e) { setError((e as Error).message); setBusy(false); }
  }

  const canSave = editing || name.trim().length > 0;
  return (
    <Screen footer={<PrimaryButton disabled={!canSave || busy} onClick={save}>{busy ? 'Saving…' : editing ? 'Save' : 'Next: Add Restaurants'}</PrimaryButton>}>
      <NavBar title="Party Settings" left={editing ? <BackLink to={lobby} label="Lobby" /> : <BackLink to="/" label="Home" />} />
      <div className="flex flex-col gap-6 px-4 pt-3 pb-4">
        {!editing && (
          <Section header="Your name" footer="Shown to your friends in this party only.">
            <label className="block"><span className="sr-only">Your name</span>
              <input value={name} onChange={(e) => setName(e.target.value.slice(0, 20))} placeholder="e.g. Kevin" autoComplete="nickname"
                className="h-[46px] w-full bg-transparent px-4 text-[17px] outline-none placeholder:text-[#C4C4C7]" />
            </label>
          </Section>
        )}

        <Section header="Location" footer="Used only to show how far each restaurant is.">
          <Row last inset={16}
            lead={<Icon name="loc" size={22} color="var(--color-brand)" />}
            title={loc ? loc.label : locState === 'finding' ? 'Finding you…' : 'No location'}
            sub={loc ? `${loc.lat.toFixed(3)}, ${loc.lng.toFixed(3)}` : locState === 'denied' ? 'Location permission was denied' : undefined}
            trail={
              <div className="flex items-center">
                {loc && <button className="min-h-11 px-2 text-[15px] text-neg" onClick={() => setLoc(null)}>Clear</button>}
                <button aria-label="Use my current location" onClick={findMe} className="grid h-11 w-11 place-items-center">
                  <Icon name="arrowloc" size={22} color="var(--color-brand)" />
                </button>
              </div>
            } />
        </Section>

        <Section header="Voting" footer="Each round keeps the top half of the restaurants until one is left, so the number of rounds follows the pool size.">
          <Row inset={16} title="Rounds" sub={editing ? `For ${pool} restaurant${pool === 1 ? '' : 's'}` : 'Set by the pool size'}
            trail={<span className="disp text-[22px]">{editing ? rounds : 'Auto'}</span>} />
          <Row last inset={16} title="Time per card"
            trail={<div className="flex items-center gap-3"><span className="disp w-12 text-right text-[22px] tabular-nums">{timePerCard}s</span>
              <Stepper value={timePerCard} onChange={setTimePerCard} min={5} max={60} step={5} label="time per card" /></div>} />
        </Section>

        <Section header="Power-ups" footer="Players earn 10 points for each pick that moves on.">
          <Row inset={16}
            lead={<div className="flex -space-x-2" aria-hidden="true"><PuIcon name="veto" size={30} /><PuIcon name="double" size={30} /><PuIcon name="sparkle" size={30} /></div>}
            title="Power-ups" sub="Veto, Double Vote and Wildcard"
            trail={<Toggle on={powerupsOn} onChange={setPowerupsOn} label="Power-ups" />} />
          <Row last inset={16} title="Starting points" dim={!powerupsOn}
            trail={<div className="flex items-center gap-3"><Points n={startingPoints} />
              <Stepper value={startingPoints} onChange={setStartingPoints} min={0} max={200} step={10} label="starting points" /></div>} />
        </Section>
      </div>
      <ErrorText>{error}</ErrorText>
    </Screen>
  );
}
