import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api, type PartyPeek } from '../lib/api';
import { Avatar, BackLink, ErrorText, Icon, PrimaryButton, Screen, Section, Spinner } from '../components/ui';

// Fig. 3 – Join a party (FR13): enter the code (or open an invite link), confirm the party, enter a name.
const ALLOWED = /[ABCDEFGHJKMNPQRSTUVWXYZ23456789]/;
const NAME_KEY = 'nomi-name';

export default function Join() {
  const params = useParams();
  const nav = useNavigate();
  const [code, setCode] = useState((params.code ?? '').toUpperCase().slice(0, 5));
  const [peek, setPeek] = useState<PartyPeek | null>(null);
  const [looking, setLooking] = useState(false);
  const [name, setName] = useState(() => localStorage.getItem(NAME_KEY) ?? '');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const codeInput = useRef<HTMLInputElement>(null);
  const nameInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setPeek(null); setError(null);
    if (code.length !== 5) return;
    let live = true;
    setLooking(true);
    api.peekParty(code).then((p) => {
      if (!live) return;
      if (!p) setError('No party with that code. Check it with your host.');
      else if (p.already_member) nav(`/p/${p.code}`, { replace: true });
      else if (p.status !== 'lobby') setError('Voting has already started in this party, so it can’t take new players.');
      else { setPeek(p); setTimeout(() => nameInput.current?.focus(), 50); }
    }).catch((e) => live && setError(e.message)).finally(() => live && setLooking(false));
    return () => { live = false; };
  }, [code, nav]);

  const onCode = (v: string) => {
    const clean = v.toUpperCase().split('').filter((c) => ALLOWED.test(c)).join('').slice(0, 5);
    setCode(clean);
  };

  async function join() {
    if (!peek || !name.trim()) return;
    setBusy(true); setError(null);
    try {
      localStorage.setItem(NAME_KEY, name.trim());
      const r = await api.joinParty(peek.code, name.trim());
      nav(`/p/${r.code}`, { replace: true });
    } catch (e) { setError((e as Error).message); setBusy(false); }
  }

  const boxes = Array.from({ length: 5 }, (_, i) => code[i] ?? '');
  return (
    <Screen footer={<PrimaryButton disabled={!peek || !name.trim() || busy} onClick={join}>{busy ? 'Joining…' : 'Join Party'}</PrimaryButton>}>
      <div className="px-2"><BackLink to="/" label="Back" /></div>
      <div className="px-4">
        <h1 className="disp m-0 text-[30px] tracking-[-0.8px]">Join a Party</h1>
        <p className="mt-0.5 mb-0 text-[15px] text-sec">Enter the 5-character code on your host’s screen.</p>

        {/* Visible tiles over a real (transparent) input, so mobile keyboards and paste both work */}
        <label className="relative mt-4 block cursor-text" onClick={() => codeInput.current?.focus()}>
          <span className="sr-only">Party code</span>
          <input ref={codeInput} value={code} onChange={(e) => onCode(e.target.value)} autoFocus={!params.code}
            inputMode="text" autoCapitalize="characters" autoComplete="off" autoCorrect="off" spellCheck={false} maxLength={8}
            className="absolute inset-0 z-10 h-full w-full opacity-0" aria-describedby="code-help" />
          <div className="flex justify-between gap-2" aria-hidden="true">
            {boxes.map((ch, i) => {
              const active = i === Math.min(code.length, 4);
              return (
                <span key={i} className="disp grid h-[60px] flex-1 place-items-center rounded-xl bg-white text-[30px]"
                  style={{ boxShadow: active && !peek ? 'inset 0 0 0 2.5px var(--color-brand),0 5px 0 var(--color-brand)' : 'inset 0 0 0 2px #000,0 5px 0 #000' }}>{ch}</span>
              );
            })}
          </div>
        </label>
        <p id="code-help" className="sr-only">Codes never use O, 0, I, 1 or L.</p>

        <div className="mt-5 min-h-[60px]" aria-live="polite">
          {looking && <div className="flex justify-center py-3"><Spinner /></div>}
          {peek && (
            <div className="flex items-center gap-3 rounded-xl bg-white px-4 py-3">
              <span className="grid h-[22px] w-[22px] place-items-center rounded-full bg-brand"><Icon name="check" size={14} color="#fff" sw={3} /></span>
              <div className="flex-1">
                <div className="text-[15px] font-semibold">{peek.host_name ?? 'Your host'}’s Party found</div>
                <div className="text-[13px] text-sec">{peek.player_count} {peek.player_count === 1 ? 'person' : 'people'} in the lobby</div>
              </div>
              {peek.host_color && <Avatar color={peek.host_color} face={0} size={28} />}
            </div>
          )}
        </div>
      </div>
      <ErrorText>{error}</ErrorText>

      <Section header="Your name" footer="Your name is only used in this party." className="mt-2 px-4">
        <label className="block">
          <span className="sr-only">Your name</span>
          <input ref={nameInput} value={name} onChange={(e) => setName(e.target.value.slice(0, 20))} placeholder="e.g. Kelly"
            onKeyDown={(e) => e.key === 'Enter' && join()} disabled={!peek} autoComplete="nickname" enterKeyHint="go"
            className="h-[46px] w-full bg-transparent px-4 text-[17px] outline-none placeholder:text-[#C4C4C7] disabled:opacity-50" />
        </label>
      </Section>
    </Screen>
  );
}
