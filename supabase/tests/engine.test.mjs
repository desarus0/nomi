import { PGlite } from '@electric-sql/pglite';
import fs from 'node:fs';

const db = new PGlite();
await db.exec(`
  create role anon; create role authenticated;
  create schema auth;
  create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('app.uid', true),'')::uuid $$;
  create publication supabase_realtime;
`);
const migDir = new URL('../migrations/', import.meta.url);
for (const f of fs.readdirSync(migDir).filter((f) => f.endsWith('.sql')).sort()) {
  try { await db.exec(fs.readFileSync(new URL(f, migDir), 'utf8')); }
  catch (e) { console.log('MIGRATION ERROR in', f, e.message, e.where ?? ''); process.exit(1); }
}
process.on("unhandledRejection", e => { console.log("FAIL:", e.message, e.where ?? ""); process.exit(1); });

const U = { host: '00000000-0000-0000-0000-000000000001', kelly: '00000000-0000-0000-0000-000000000002', marcus: '00000000-0000-0000-0000-000000000003' };
async function as(u, sql, params = []) {
  await db.query(`select set_config('app.uid', $1, false)`, [U[u]]);
  const r = await db.query(sql, params);
  return r.rows[0] ? Object.values(r.rows[0])[0] : null;
}
const assert = (c, m) => { if (!c) { throw new Error('ASSERT: ' + m); } console.log('ok -', m); };
async function expectErr(p, m) { try { await p; } catch (e) { console.log('ok - rejects:', m, '→', e.message); return; } throw new Error('expected error: ' + m); }

const { party_id: pid, code } = await as('host', `select create_party('Kevin')`);
assert(/^[A-HJKMNP-Z2-9]{5}$/.test(code), 'code has no look-alikes: ' + code);
const peek = await as('kelly', `select peek_party($1)`, [code.toLowerCase()]);
assert(peek.host_name === 'Kevin' && peek.player_count == 1, 'peek_party works case-insensitively');
await as('kelly', `select join_party($1,'Kelly')`, [code]);
await as('marcus', `select join_party($1,'Marcus')`, [code]);
await expectErr(as('kelly', `select update_settings($1,null,null,null,10,true,60)`, [pid]), 'non-host settings');
await as('host', `select update_settings($1,37.76,-122.43,'Dolores Park',10,true,60)`, [pid]);

const names = ['Golden Lotus Pho', 'Taqueria El Sol', 'Bao Down', 'Slice Society', 'Smokehouse 89', 'Sushi Tora', 'Burger Lab', 'Curry Leaf'];
await expectErr(as('host', `select start_voting($1)`, [pid]), 'start with <4 restaurants');
const rid = {};
for (const [i, n] of names.entries()) {
  const photos = i === 0 ? [
    { name: 'places/abc/photos/p1', attribution: 'Ann' }, { name: 'bad name', attribution: 'x' },
    { name: 'places/abc/photos/p2', attribution: null }, { name: 'places/abc/photos/p3' }, { name: 'places/abc/photos/p4' },
  ] : undefined;
  rid[n] = await as(i % 2 ? 'kelly' : 'host', `select add_restaurant($1,$2)`, [pid, { place_id: 'p' + i, name: n, cuisine: 'X', price_level: 2, photos }]);
}
{
  const s0 = await as('host', `select get_state($1)`, [pid]);
  const ph = s0.restaurants.find((r) => r.name === names[0]).photos;
  assert(ph.length === 2 && ph[0].name === 'places/abc/photos/p1' && ph[0].attribution === 'Ann', 'photos: keeps valid refs from the first 3, drops malformed: ' + JSON.stringify(ph));
  assert(s0.restaurants.find((r) => r.name === names[1]).photos === null, 'photos: null when none given');
}
await expectErr(as('host', `select add_restaurant($1,$2)`, [pid, { place_id: 'p0', name: 'dup' }]), 'duplicate restaurant');
await expectErr(as('kelly', `select start_voting($1)`, [pid]), 'non-host start');
await as('host', `select start_voting($1)`, [pid]);
await db.query(`select set_config('app.uid','00000000-0000-0000-0000-000000000009',false)`);
await expectErr(db.query(`select join_party($1,'Late')`, [code]), 'late joiner');
await expectErr(as('kelly', `select submit_vote($1,$2,'yum')`, [pid, rid['Bao Down']]), 'vote before start');
await db.exec(`update rounds set starts_at = now() - interval '1 second'`);

let st = await as('host', `select get_state($1)`, [pid]);
assert(st.players.every(p => p.points === 60), 'everyone starts with 60 points');

// Round 1: Kelly vetoes Bao Down, Marcus double votes, host plays wildcard.
await as('kelly', `select play_power_up($1,'veto',$2,null)`, [pid, rid['Bao Down']]);
await expectErr(as('kelly', `select play_power_up($1,'double',null,null)`, [pid]), 'second power-up same round');
await as('marcus', `select play_power_up($1,'double',null,null)`, [pid]);
await as('host', `select play_power_up($1,'wildcard',null,$2)`, [pid, { place_id: 'wc', name: 'Cluck & Co.' }]);
st = await as('kelly', `select get_state($1)`, [pid]);
assert(!st.restaurants.some(r => r.name === 'Cluck & Co.'), 'pending wildcard hidden from others');
assert(st.power_ups.filter(p => p.player_id !== st.me).every(p => p.target_restaurant_id === null), 'others\' targets hidden during round');
assert(st.power_ups.length === 3, 'everyone sees who played power-ups');

const votes = {
  host:   ['Golden Lotus Pho', 'Taqueria El Sol', 'Bao Down', 'Sushi Tora'],
  kelly:  ['Golden Lotus Pho', 'Bao Down', 'Sushi Tora'],
  marcus: ['Bao Down', 'Taqueria El Sol', 'Curry Leaf'],
};
for (const u of ['host', 'kelly', 'marcus']) {
  for (const n of names) await as(u, `select submit_vote($1,$2,$3)`, [pid, rid[n], votes[u].includes(n) ? 'yum' : 'nope']);
}
st = await as('host', `select get_state($1)`, [pid]);
const r1 = st.rounds.find(r => r.number === 1);
assert(r1.status === 'resolved', 'round resolves when everyone is done');
const res = Object.fromEntries(st.round_results.filter(r => r.round_id === r1.id).map(r => [st.restaurants.find(x => x.id === r.restaurant_id)?.name, r]));
console.log(Object.entries(res).map(([n, r]) => `${n}: ${r.yums}${r.vetoed ? ' (vetoed ' + r.raw_yums + ')' : ''}${r.doubled ? ' x2' : ''} ${r.advanced ? 'NEXT' : 'OUT'}`).join('\n'));
assert(res['Bao Down'].vetoed && res['Bao Down'].yums === 0 && res['Bao Down'].raw_yums === 3 && !res['Bao Down'].advanced, 'veto zeroes yums (raw 3 kept for display)');
assert(res['Taqueria El Sol'].yums === 3 && res['Taqueria El Sol'].doubled, 'double vote counted on Marcus\'s next Yum');
assert(Object.values(res).filter(r => r.advanced).length === 4, '8 -> 4 advance (Curry Leaf ties at cutoff)');
const inPlay = st.restaurants.filter(r => r.in_play).map(r => r.name);
assert(inPlay.includes('Cluck & Co.') && inPlay.length === 5, 'wildcard joins round 2 on top: ' + inPlay.join(', '));
const pts = Object.fromEntries(st.players.map(p => [p.name, p.points]));
console.log('points', pts);
assert(pts.Kevin === 60 - 35 + 30 && pts.Kelly === 60 - 40 + 20, 'points: spend + 10 per advancing non-vetoed yum');
assert(st.rounds.length === 2 && st.party.current_round === 2, 'round 2 created');

// Round 2: time runs out with no votes -> random tie-break keeps exactly 3 of 5.
await db.exec(`update rounds set starts_at = now() - interval '100 seconds', ends_at = now() - interval '1 second' where number = 2`);
await as('kelly', `select tick($1)`, [pid]);
st = await as('kelly', `select get_state($1)`, [pid]);
assert(st.rounds[1].status === 'resolved' && st.restaurants.filter(r => r.in_play).length === 3, 'timeout + all-tied -> random cut to ceil(5/2)=3');

// Host leaves mid-game -> next player becomes host; round 3 completes with 2 players.
await as('host', `select leave_party($1)`, [pid]);
st = await as('kelly', `select get_state($1)`, [pid]);
assert(st.party.host_player_id === st.me, 'Kelly becomes host');
await db.exec(`update rounds set starts_at = now() - interval '1 second' where number = 3`);
for (const u of ['kelly', 'marcus']) {
  const s = await as(u, `select get_state($1)`, [pid]);
  for (const r of s.restaurants.filter(r => r.in_play)) await as(u, `select submit_vote($1,$2,'yum')`, [pid, r.id]);
}
st = await as('kelly', `select get_state($1)`, [pid]);
console.log('rounds', st.rounds.map(r => r.number + ':' + r.status).join(' '), 'status', st.party.status, 'in play', st.restaurants.filter(r => r.in_play).map(r => r.name));
// Play out remaining rounds by timeout until finished.
for (let i = 0; i < 6 && st.party.status !== 'finished'; i++) {
  await db.exec(`update rounds set starts_at = now() - interval '100 seconds', ends_at = now() - interval '1 second' where status = 'voting'`);
  await as('kelly', `select tick($1)`, [pid]);
  st = await as('kelly', `select get_state($1)`, [pid]);
}
assert(st.party.status === 'finished' && st.party.winner_restaurant_id, 'party finishes with a winner: ' + st.restaurants.find(r => r.id === st.party.winner_restaurant_id).name);

// Security: authenticated can't call internals.
const priv = await db.query(`select has_function_privilege('authenticated','public._resolve_round(uuid)','execute') a, has_function_privilege('authenticated','public.get_state(uuid)','execute') b`);
assert(!priv.rows[0].a && priv.rows[0].b, 'internal functions not executable by clients');
console.log('ALL PASSED');
