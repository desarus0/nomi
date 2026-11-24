import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { api } from '../lib/api';
import { roundsFor } from '../lib/format';
import { useParty } from '../lib/party';
import { POOL_MIN } from '../lib/types';
import { Avatar, CodeTiles, ErrorText, Icon, NavBar, PrimaryButton, Row, Screen, SecondaryButton, Section, Sheet, SheetHead, ThinkBubble, type IconName } from '../components/ui';

// Fig. 4 – Lobby (FR05): share the code, see who is ready; only the host can start voting.
export default function Lobby() {
  const { state, me, isHost, activePlayers, refresh } = useParty();
  const nav = useNavigate();
  const { party, restaurants } = state;
  const [toast, setToast] = useState<string | null>(null);
  const [qr, setQr] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const link = `${location.origin}/join/${party.code}`;
  const ready = activePlayers.filter((p) => p.ready || p.id === party.host_player_id).length;
  const enough = restaurants.length >= POOL_MIN;

  const flash = (t: string) => { setToast(t); setTimeout(() => setToast(null), 1800); };
  async function copy() {
    try { await navigator.clipboard.writeText(link); flash('Invite link copied'); } catch { flash(link); }
  }
  async function share() {
    if (navigator.share) {
      try { await navigator.share({ title: 'Join my Nomi party', text: `Help pick where we eat! Code ${party.code}`, url: link }); } catch { /* cancelled */ }
    } else copy();
  }
  async function run(fn: () => Promise<void>) {
    setBusy(true); setError(null);
    try { await fn(); await refresh(); } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }
  async function leave() {
    if (!confirm(isHost ? 'Leave the party? Another player will become host.' : 'Leave this party?')) return;
    await api.leave(party.id).catch(() => {});
    nav('/', { replace: true });
  }

  const action = (icon: IconName, label: string, onClick: () => void) => (
    <button onClick={onClick} className="flex min-h-[54px] flex-1 flex-col items-center justify-center gap-1 rounded-xl bg-bg text-[12px] font-semibold">
      <Icon name={icon} size={20} sw={2} />{label}
    </button>
  );

  return (
    <Screen footer={
      <div>
        <ErrorText>{error}</ErrorText>
        {isHost ? (
          <>
            <PrimaryButton disabled={!enough || busy} onClick={() => run(() => api.startVoting(party.id))}>{busy ? 'Starting…' : 'Start Voting'}</PrimaryButton>
            <p className="mt-2 mb-0 text-center text-[13px] text-sec">{enough ? `${ready} of ${activePlayers.length} ready · everyone votes at once` : `Add at least ${POOL_MIN} restaurants to start`}</p>
          </>
        ) : (
          <>
            {me.ready
              ? <SecondaryButton disabled={busy} onClick={() => run(() => api.setReady(party.id, false))}>Not Ready Yet</SecondaryButton>
              : <PrimaryButton disabled={busy} onClick={() => run(() => api.setReady(party.id, true))} icon="check">I’m Ready</PrimaryButton>}
            <p className="mt-2 mb-0 text-center text-[13px] text-sec">Waiting for the host to start voting</p>
          </>
        )}
      </div>
    }>
      <NavBar title="Lobby" left={<button onClick={leave} className="min-h-11 px-2 text-[17px] text-neg">Leave</button>} />
      <div className="flex flex-col gap-5 px-4 pt-2 pb-4">
        <div className="rounded-2xl bg-white px-3 pt-3 pb-3">
          <p className="m-0 mb-2.5 text-center text-[12px] font-semibold tracking-[0.6px] text-sec">PARTY CODE</p>
          <CodeTiles code={party.code} size={50} fontSize={28} />
          <div className="mt-4 flex gap-2">
            {action('link', 'Copy Link', copy)}
            {action('qr', 'QR Code', () => setQr(true))}
            {action('share', 'Share', share)}
          </div>
        </div>

        <div>
          <div className="mb-2 flex items-baseline justify-between px-1">
            <h2 className="disp m-0 text-[20px]">Players · {activePlayers.length}</h2>
            <span className="text-[15px] text-sec">{ready} of {activePlayers.length} ready</span>
          </div>
          <ul className="m-0 grid list-none grid-cols-3 gap-2 p-0">
            {activePlayers.map((p) => {
              const host = p.id === party.host_player_id;
              const isReady = host || p.ready;
              return (
                <li key={p.id} className="flex flex-col items-center rounded-2xl bg-white px-1 pt-3 pb-2.5">
                  <div className="relative">
                    <Avatar color={p.color} face={p.face} size={44} host={host} className={isReady ? '' : 'bob'} />
                    {!isReady && <ThinkBubble />}
                  </div>
                  <span className="mt-1.5 max-w-full truncate text-[15px] font-semibold">{p.name}{p.id === me.id && <span className="font-normal text-sec"> (you)</span>}</span>
                  {host ? <span className="mt-0.5 rounded bg-black px-1.5 text-[10px] font-extrabold tracking-[0.5px] text-white">HOST</span>
                    : isReady ? <span className="mt-0.5 flex items-center gap-0.5 text-[13px] font-semibold text-brand"><Icon name="check" size={13} sw={3} />Ready</span>
                    : <span className="mt-0.5 text-[13px] text-sec">Joining…</span>}
                </li>
              );
            })}
          </ul>
        </div>

        <Section>
          <Row lead={<span className="grid h-8 w-8 place-items-center rounded-lg bg-black"><Icon name="map" size={18} color="#fff" /></span>}
            title="Restaurant Pool" sub={`${restaurants.length} added · ${POOL_MIN} minimum`} inset={60}
            onClick={() => nav(`/p/${party.code}/pool`)} trail={<span className="text-[15px] text-brand">{enough ? 'Edit' : 'Add'}</span>} last={!isHost} />
          {isHost && (
            <Row last lead={<span className="grid h-8 w-8 place-items-center rounded-lg bg-black"><Icon name="gear" size={18} color="#fff" /></span>}
              title="Party Settings" onClick={() => nav(`/p/${party.code}/settings`)} trail={<span className="text-[15px] text-brand">Edit</span>}
              sub={`${roundsFor(Math.max(restaurants.length, POOL_MIN))} rounds · ${party.time_per_card} s per card · Power-ups ${party.powerups_on ? 'on' : 'off'}`} />
          )}
        </Section>
        {!isHost && (
          <p className="m-0 px-1 text-[13px] text-sec">
            {party.time_per_card} s per card · Power-ups {party.powerups_on ? `on · ${party.starting_points} starting points` : 'off'}
          </p>
        )}
      </div>

      {toast && <div role="status" className="fade-in fixed bottom-28 left-1/2 z-50 max-w-[90vw] -translate-x-1/2 truncate rounded-full bg-black px-4 py-2 text-[15px] text-white">{toast}</div>}
      {qr && (
        <Sheet onClose={() => setQr(false)} label="Invite QR code">
          <SheetHead title="Scan to join" onClose={() => setQr(false)} />
          <div className="flex flex-col items-center gap-4 px-4 pt-4 pb-6">
            <div className="rounded-2xl bg-white p-5"><QRCodeSVG value={link} size={220} aria-label={`QR code for ${link}`} /></div>
            <CodeTiles code={party.code} size={40} fontSize={22} />
            <p className="m-0 text-[13px] break-all text-sec">{link}</p>
          </div>
        </Sheet>
      )}
    </Screen>
  );
}

