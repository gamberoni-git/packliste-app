// Dokumenten-Safe: verschlüsselte Offline-Ablage (IndexedDB + WebCrypto AES-GCM).
// Schlüssel wird per PBKDF2 aus der Passphrase abgeleitet und nur im RAM gehalten.

const SAFE_DB_NAME = 'packlist-safe';
let safeKey = null;        // CryptoKey, nur während der Session
let safeDocsCache = null;  // entschlüsselte Metadaten fürs Rendering

function safeIdb() {
  return new Promise((res, rej) => {
    const r = indexedDB.open(SAFE_DB_NAME, 1);
    r.onupgradeneeded = () => {
      const db = r.result;
      if (!db.objectStoreNames.contains('docs')) db.createObjectStore('docs', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('meta')) db.createObjectStore('meta', { keyPath: 'k' });
    };
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}

function safeTx(store, mode, fn) {
  return safeIdb().then(db => new Promise((res, rej) => {
    const tx = db.transaction(store, mode);
    const out = fn(tx.objectStore(store));
    tx.oncomplete = () => res(out && out.result !== undefined ? out.result : undefined);
    tx.onerror = () => rej(tx.error);
  }));
}

function safeGet(store, key) {
  return safeIdb().then(db => new Promise((res, rej) => {
    const rq = db.transaction(store).objectStore(store).get(key);
    rq.onsuccess = () => res(rq.result);
    rq.onerror = () => rej(rq.error);
  }));
}

function safeAll(store) {
  return safeIdb().then(db => new Promise((res, rej) => {
    const rq = db.transaction(store).objectStore(store).getAll();
    rq.onsuccess = () => res(rq.result);
    rq.onerror = () => rej(rq.error);
  }));
}

const safeEnc = new TextEncoder();
const safeDec = new TextDecoder();

async function safeDeriveKey(pass, salt) {
  const km = await crypto.subtle.importKey('raw', safeEnc.encode(pass), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: 250000, hash: 'SHA-256' },
    km, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']
  );
}

async function safeEncrypt(buf) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, safeKey, buf);
  return { iv, ct };
}

async function safeDecrypt(iv, ct) {
  return crypto.subtle.decrypt({ name: 'AES-GCM', iv }, safeKey, ct);
}

// ---- Setup / Unlock ----
async function safeHasSetup() {
  return !!(await safeGet('meta', 'safe'));
}

async function safeSetup(pass) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  safeKey = await safeDeriveKey(pass, salt);
  const check = await safeEncrypt(safeEnc.encode('packlist-safe-ok'));
  await safeTx('meta', 'readwrite', s => s.put({ k: 'safe', salt, iv: check.iv, ct: check.ct }));
  safeDocsCache = [];
}

async function safeUnlock(pass) {
  const meta = await safeGet('meta', 'safe');
  if (!meta) return false;
  try {
    safeKey = await safeDeriveKey(pass, meta.salt);
    const ok = safeDec.decode(await safeDecrypt(meta.iv, meta.ct));
    if (ok !== 'packlist-safe-ok') throw new Error('check failed');
    return true;
  } catch (e) {
    safeKey = null;
    return false;
  }
}

function safeLock() {
  safeKey = null;
  safeDocsCache = null;
}

async function safeReset() {
  await safeTx('docs', 'readwrite', s => s.clear());
  await safeTx('meta', 'readwrite', s => s.clear());
  safeLock();
}

// ---- Dokumente ----
// Record: {id, type:'file'|'note'|'address', created, size, miv, mct, iv?, ct?}
// mct entschlüsselt zu {name, mime?, text?, address?}; ct = Datei-Bytes

async function safeAddFile(file) {
  const bytes = await file.arrayBuffer();
  const m = await safeEncrypt(safeEnc.encode(JSON.stringify({ name: file.name, mime: file.type || 'application/octet-stream' })));
  const c = await safeEncrypt(bytes);
  await safeTx('docs', 'readwrite', s => s.put({
    id: uid(), type: 'file', created: Date.now(), size: file.size,
    miv: m.iv, mct: m.ct, iv: c.iv, ct: c.ct,
  }));
  safeDocsCache = null;
}

async function safeAddEntry(type, name, text) {
  const m = await safeEncrypt(safeEnc.encode(JSON.stringify(
    type === 'address' ? { name, address: text } : { name, text }
  )));
  await safeTx('docs', 'readwrite', s => s.put({
    id: uid(), type, created: Date.now(), size: text.length,
    miv: m.iv, mct: m.ct,
  }));
  safeDocsCache = null;
}

async function safeDelete(id) {
  await safeTx('docs', 'readwrite', s => s.delete(id));
  safeDocsCache = null;
}

// Liste mit entschlüsselten Metadaten
async function safeListDocs() {
  if (safeDocsCache) return safeDocsCache;
  const docs = await safeAll('docs');
  const out = [];
  for (const d of docs) {
    try {
      const meta = JSON.parse(safeDec.decode(await safeDecrypt(d.miv, d.mct)));
      out.push({ id: d.id, type: d.type, created: d.created, size: d.size, ...meta });
    } catch (e) { /* Eintrag mit anderem Schlüssel – überspringen */ }
  }
  out.sort((a, b) => b.created - a.created);
  safeDocsCache = out;
  return out;
}

// Datei-Bytes entschlüsseln -> Object-URL
async function safeFileUrl(id) {
  const d = await safeGet('docs', id);
  const meta = JSON.parse(safeDec.decode(await safeDecrypt(d.miv, d.mct)));
  const bytes = await safeDecrypt(d.iv, d.ct);
  return { url: URL.createObjectURL(new Blob([bytes], { type: meta.mime })), meta };
}
