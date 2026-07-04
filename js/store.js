// Persistenz (localStorage) und Datenzugriff
const STORAGE_KEY = 'packlist_v1';
const APP_VERSION = '0.1.0';

function defaultState() {
  return {
    settings: { lang: 'de', theme: 'system', homeCountry: 'CH' },
    // Eigene Artikel des Users (Garderobe): {id, name, cat, defQty, prio, lastMinute}
    customItems: [],
    // Eigene Kategorien: {id, name, icon}
    customCats: [],
    // Packlisten
    lists: [],
  };
}

let state = loadState();

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return Object.assign(defaultState(), JSON.parse(raw));
  } catch (e) { console.warn('loadState failed', e); }
  return defaultState();
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

// ---- Übersetzungs-Helfer ----
function t(key, vars) {
  let s = (I18N[state.settings.lang] || I18N.de)[key] || key;
  if (vars) for (const k in vars) s = s.replace('{' + k + '}', vars[k]);
  return s;
}

// Name eines Katalog- oder Custom-Artikels in aktueller Sprache
function itemDefName(key) {
  const it = ITEMS[key];
  if (it) return state.settings.lang === 'en' ? it[2] : it[1];
  const ci = state.customItems.find(c => c.id === key);
  return ci ? ci.name : key;
}

// Name eines Listen-Items: Custom-Name gewinnt, sonst Katalog-Name
function listItemName(li) {
  if (li.n) return li.n;
  if (li.k) return itemDefName(li.k);
  return '?';
}

function catName(catId) {
  const c = CATS[catId];
  if (c) return state.settings.lang === 'en' ? c.en : c.de;
  const cc = state.customCats.find(x => x.id === catId);
  return cc ? cc.name : t('uncategorized');
}

function catIcon(catId) {
  const c = CATS[catId];
  if (c) return c.icon;
  const cc = state.customCats.find(x => x.id === catId);
  return cc ? (cc.icon || '📦') : '📦';
}

function allCatIds() {
  return CAT_ORDER.concat(state.customCats.map(c => c.id));
}

function optName(dict, key) {
  const o = dict[key];
  if (!o) return key;
  return state.settings.lang === 'en' ? o.en : o.de;
}

// ---- Listen-Erstellung aus Templates ----
function computeQty(def, days) {
  if (def === 'D') return Math.max(2, Math.min((days || 7) + 1, 10));
  return def;
}

function buildListItems(tripType, activities, transport, climate, days) {
  const keys = [];
  const push = (arr) => (arr || []).forEach(k => { if (!keys.includes(k)) keys.push(k); });
  push((TRIP_TYPES[tripType] || {}).items);
  (activities || []).forEach(a => push((ACTIVITIES[a] || {}).items));
  (transport || []).forEach(tr => push((TRANSPORT[tr] || {}).items));
  (climate || []).forEach(cl => push((CLIMATE[cl] || {}).items));
  return keys.map(k => {
    const def = ITEMS[k];
    return {
      id: uid(),
      k: k,             // Referenz auf Katalog-Artikel (für Sprachwechsel)
      n: null,          // eigener Name (nur bei Custom-Artikeln)
      c: def[0],
      q: computeQty(def[3], days),
      p: def[4],
      lm: !!def[5],
      packed: false,
    };
  });
}

function tripDays(list) {
  if (list.days) return list.days;
  if (list.dateFrom && list.dateTo) {
    const d = Math.round((new Date(list.dateTo) - new Date(list.dateFrom)) / 86400000) + 1;
    return d > 0 ? d : 1;
  }
  return null;
}

// ---- Export / Import ----
function exportListPayload(list) {
  // Custom-Kategorien mitgeben, die die Liste verwendet
  const usedCats = [...new Set(list.items.map(i => i.c))];
  const cats = state.customCats.filter(c => usedCats.includes(c.id));
  return { type: 'packlist-list', version: 1, list, customCats: cats };
}

function exportBackupPayload() {
  return { type: 'packlist-backup', version: 1, appVersion: APP_VERSION, data: state };
}

function importPayload(payload) {
  if (!payload || typeof payload !== 'object') throw new Error('invalid');
  if (payload.type === 'packlist-backup') {
    state = Object.assign(defaultState(), payload.data);
    saveState();
    return 'backup';
  }
  if (payload.type === 'packlist-list') {
    const list = payload.list;
    list.id = uid(); // neue ID, damit nichts überschrieben wird
    list.items.forEach(i => { i.id = uid(); i.packed = false; });
    (payload.customCats || []).forEach(cc => {
      if (!state.customCats.find(c => c.id === cc.id)) state.customCats.push(cc);
    });
    // Referenzen auf Custom-Items des Absenders in Klartext-Namen umwandeln
    list.items.forEach(i => {
      if (i.k && !ITEMS[i.k] && !state.customItems.find(c => c.id === i.k)) {
        i.n = i.n || i.k; i.k = null;
      }
    });
    state.lists.unshift(list);
    saveState();
    return list;
  }
  throw new Error('unknown type');
}
