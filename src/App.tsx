import { useEffect, useState } from 'react';
import { BrowserRouter, Link, Navigate, Route, Routes, useNavigate, useParams } from 'react-router-dom';
import { api } from './lib/api';
import { PartyProvider } from './lib/party';
import { supabaseConfigured } from './lib/supabase';
import { Centered, PrimaryButton, Spinner } from './components/ui';
import Home from './screens/Home';
import Join from './screens/Join';
import Settings from './screens/Settings';
import Pool from './screens/Pool';
import PartyHome from './screens/PartyHome';

export default function App() {
  if (!supabaseConfigured) {
    return (
      <Centered>
        <h1 className="disp text-3xl">Almost there</h1>
        <p className="text-sec">Set <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_ANON_KEY</code> (see README), then restart.</p>
      </Centered>
    );
  }
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/join" element={<Join />} />
        <Route path="/join/:code" element={<Join />} />
        <Route path="/new" element={<Settings />} />
        <Route path="/p/:code/*" element={<PartyRoute />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

function PartyRoute() {
  const { code = '' } = useParams();
  const nav = useNavigate();
  const [partyId, setPartyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    setPartyId(null);
    api.peekParty(code).then((p) => {
      if (!live) return;
      if (!p) setError('That party doesn’t exist.');
      else if (!p.already_member) nav(`/join/${p.code}`, { replace: true });
      else setPartyId(p.party_id);
    }).catch((e) => live && setError(e.message));
    return () => { live = false; };
  }, [code, nav]);

  const fallback = ({ error: e }: { error?: string }) => (
    <Centered>
      {e || error ? (
        <>
          <p className="text-[17px]">{e || error}</p>
          <Link to="/" className="w-full"><PrimaryButton>Home</PrimaryButton></Link>
        </>
      ) : <Spinner />}
    </Centered>
  );

  if (!partyId) return fallback({});
  return (
    <PartyProvider partyId={partyId} fallback={fallback}>
      <Routes>
        <Route index element={<PartyHome />} />
        <Route path="settings" element={<Settings />} />
        <Route path="pool" element={<Pool />} />
        <Route path="*" element={<Navigate to="" replace />} />
      </Routes>
    </PartyProvider>
  );
}
