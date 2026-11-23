/**
 * An app that keeps its sign-in in the browser's IndexedDB (Firebase and others) - Trova keeps every database of
 * the app's address, every store with its records, and puts them back before the app opens. One rule list in the TS
 * starter (here), Java's IndexedDbRules (Java suites) and the AI's trova-indexeddb-rules (AI runs and sessions) - checked
 * by IndexedDbParityTest. Values stay in the kept copy: the scripts never print or log one, and the TS starter hands them
 * in and out by its page channel (pageChannel.ts), never in a call a trace keeps.
 * A value the browser cannot hand out (a file or a locked key) is marked "left", its record is not put back and its
 * database is marked leftOut 'part'; a database past 2 MB is not read further and kept as {name, leftOut: 'big'} only.
 */

/** page code (a function): every database of the page's address, as JSON - [{name, version, stores: [{..., records}]}] */
export const IDB_READ = `async function idbRead() {
  const req = (r) => new Promise((ok, bad) => { r.onsuccess = () => ok(r.result); r.onerror = () => bad(r.error); });
  const b64 = (u) => { let s = ''; for (let i = 0; i < u.length; i++) s += String.fromCharCode(u[i]); return btoa(s); };
  const enc = (v) => {
    if (v === undefined) return { $idb: 'undefined' };
    if (typeof v === 'bigint') return { $idb: 'bigint', v: String(v) };
    if (typeof v === 'number' && !isFinite(v)) return { $idb: 'number', v: String(v) };
    if (v === null || typeof v !== 'object') return v;
    if (v instanceof Date) return { $idb: 'date', v: v.getTime() };
    if (v instanceof ArrayBuffer) return { $idb: 'bytes', v: b64(new Uint8Array(v)) };
    if (ArrayBuffer.isView(v)) return { $idb: 'view', t: v.constructor.name, v: b64(new Uint8Array(v.buffer, v.byteOffset, v.byteLength)) };
    if (v instanceof Map) return { $idb: 'map', v: Array.from(v.entries()).map((e) => [enc(e[0]), enc(e[1])]) };
    if (v instanceof Set) return { $idb: 'set', v: Array.from(v.values()).map(enc) };
    if (Array.isArray(v)) return v.map(enc);
    if ((typeof Blob !== 'undefined' && v instanceof Blob) || (typeof CryptoKey !== 'undefined' && v instanceof CryptoKey)) return { $idb: 'left' };
    const o = {};
    for (const k of Object.keys(v)) o[k] = enc(v[k]);
    return o;
  };
  const LIMIT = 2097152;
  if (!window.indexedDB || !indexedDB.databases) return [];
  const out = [];
  for (const info of await indexedDB.databases()) {
    if (!info.name) continue;
    let db;
    try { db = await req(indexedDB.open(info.name)); } catch (e) { continue; }
    try {
      const stores = [];
      const seen = { size: 0, big: false, part: false };
      for (const name of Array.from(db.objectStoreNames)) {
        if (seen.big) break;
        const st = db.transaction(name, 'readonly').objectStore(name);
        const indexes = Array.from(st.indexNames).map((n) => { const i = st.index(n); return { name: n, keyPath: i.keyPath, unique: i.unique, multiEntry: i.multiEntry }; });
        const records = [];
        await new Promise((ok, bad) => {
          const c = st.openCursor();
          c.onerror = () => bad(c.error);
          c.onsuccess = () => {
            const cur = c.result;
            if (!cur) { ok(); return; }
            const rec = { key: enc(cur.primaryKey), value: enc(cur.value) };
            const text = JSON.stringify(rec);
            if (text.indexOf('"$idb":"left"') >= 0) seen.part = true;
            seen.size += text.length;
            if (seen.size > LIMIT) { seen.big = true; ok(); return; }
            records.push(rec);
            cur.continue();
          };
        });
        stores.push({ name: name, keyPath: st.keyPath, autoIncrement: st.autoIncrement, indexes: indexes, records: records });
      }
      if (seen.big) out.push({ name: info.name, leftOut: 'big' });
      else if (seen.part) out.push({ name: info.name, version: db.version, stores: stores, leftOut: 'part' });
      else out.push({ name: info.name, version: db.version, stores: stores });
    } catch (e) { /* a database closed while read: the others still go in */ } finally { db.close(); }
  }
  return out;
  /* idbRead end */
}`;

/** page code (a function of the kept databases): each one made again as it was, its records in; answers how many went in */
export const IDB_WRITE = `async function idbWrite(dbs) {
  const req = (r) => new Promise((ok, bad) => { r.onsuccess = () => ok(r.result); r.onerror = () => bad(r.error); });
  const unb64 = (s) => { const t = atob(s); const u = new Uint8Array(t.length); for (let i = 0; i < t.length; i++) u[i] = t.charCodeAt(i); return u; };
  const left = { left: true };
  const dec = (v) => {
    if (Array.isArray(v)) return v.map(dec);
    if (v === null || typeof v !== 'object') return v;
    if (typeof v.$idb === 'string') {
      const t = v.$idb;
      if (t === 'undefined') return undefined;
      if (t === 'bigint') return BigInt(v.v);
      if (t === 'number') return Number(v.v);
      if (t === 'date') return new Date(v.v);
      if (t === 'bytes') return unb64(v.v).buffer;
      if (t === 'view') { const u = unb64(v.v); const C = /Array$|^DataView$/.test(v.t) ? globalThis[v.t] : null; return C ? new C(u.buffer) : u; }
      if (t === 'map') return new Map(v.v.map((e) => [dec(e[0]), dec(e[1])]));
      if (t === 'set') return new Set(v.v.map(dec));
      if (t === 'left') throw left;
    }
    const o = {};
    for (const k of Object.keys(v)) o[k] = dec(v[k]);
    return o;
  };
  if (!window.indexedDB) return 0;
  let n = 0;
  for (const d of dbs || []) {
    if (!d || !d.name || d.leftOut === 'big') continue;
    await new Promise((ok) => { const r = indexedDB.deleteDatabase(d.name); r.onsuccess = ok; r.onerror = ok; r.onblocked = ok; });
    const open = indexedDB.open(d.name, d.version || 1);
    open.onupgradeneeded = () => {
      const db = open.result;
      for (const s of d.stores || []) {
        if (db.objectStoreNames.contains(s.name)) continue;
        const how = {};
        if (s.keyPath !== null && s.keyPath !== undefined) how.keyPath = s.keyPath;
        if (s.autoIncrement) how.autoIncrement = true;
        const st = db.createObjectStore(s.name, how);
        for (const i of s.indexes || []) st.createIndex(i.name, i.keyPath, { unique: !!i.unique, multiEntry: !!i.multiEntry });
      }
    };
    let db;
    try { db = await req(open); } catch (e) { continue; }
    try {
      const names = (d.stores || []).map((s) => s.name).filter((x) => db.objectStoreNames.contains(x));
      if (!names.length) continue;
      const tx = db.transaction(names, 'readwrite');
      for (const s of d.stores) {
        if (names.indexOf(s.name) < 0) continue;
        const st = tx.objectStore(s.name);
        for (const r of s.records || []) {
          try {
            const p = st.keyPath === null ? st.put(dec(r.value), dec(r.key)) : st.put(dec(r.value));
            p.onerror = (e) => { e.preventDefault(); e.stopPropagation(); };
            n++;
          } catch (e) { /* a record with a part the browser could not hand out: the others still go in */ }
        }
      }
      await new Promise((ok) => { tx.oncomplete = ok; tx.onerror = ok; tx.onabort = ok; });
    } finally { db.close(); }
  }
  return n;
  /* idbWrite end */
}`;

/** the one plain line per database left out of the kept sign-in - its name only, never a value */
export function leftOutLines(databases: unknown[]): string[] {
  const lines: string[] = [];
  for (const d of databases as { name?: string; leftOut?: string }[]) {
    if (d?.leftOut === 'big') lines.push(`The app's saved data '${d.name}' was too big to keep - the app may ask you to sign in on the screen.`);
    if (d?.leftOut === 'part') lines.push(`Part of the app's saved data '${d.name}' (a file or a locked key) could not be kept - the app may ask you to sign in on the screen.`);
  }
  return lines;
}
