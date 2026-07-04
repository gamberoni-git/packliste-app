// Persistenz (localStorage) und Datenzugriff
const STORAGE_KEY = 'packlist_v1';
const APP_VERSION = '0.4.0';

function defaultState() {
  return {
    settings: { lang: 'de', theme: 'system', homeCountry: 'CH' },
    // Eigene Artikel des Users (Garderobe): {id, name, cat, defQty, prio, lastMinute}
    customItems: [],
    // Eigene Kategorien: {id, name, icon}
    customCats: [],
    // Eigene Kacheln pro Auswahl-Screen: {id, name, icon, items?}
    custom: { tripTypes: [], transport: [], luggage: [], activities: [] },
    // Anpassungen an Standard-Kacheln: key -> {name?, icon?, hidden?}
    overrides: { tripTypes: {}, transport: {}, luggage: {}, activities: {} },
    // Manuell korrigierte Gewichte (dauerhaft): itemKey -> Gramm
    weights: {},
    // Manuell korrigierte Gepäck-Leergewichte: luggageKey -> Gramm
    luggageWeights: {},
    // Packlisten
    lists: [],
  };
}

const TILE_DICTS = { tripTypes: () => TRIP_TYPES, transport: () => TRANSPORT, luggage: () => LUGGAGE, activities: () => ACTIVITIES };

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

function itemEmoji(key, cat) {
  return (typeof ITEM_EMOJI !== 'undefined' && ITEM_EMOJI[key]) || catIcon(cat);
}

// Effektive Kachel-Einträge eines Screens: Standards (ohne versteckte, mit
// Overrides) + eigene Einträge. Rückgabe: [{key, label, icon, items, custom}]
function tileEntries(dictName) {
  const base = TILE_DICTS[dictName]();
  const out = [];
  for (const k in base) {
    const ov = state.overrides[dictName][k] || {};
    if (ov.hidden) continue;
    out.push({ key: k, label: ov.name || optName(base, k), icon: ov.icon || base[k].icon, items: base[k].items || [], custom: false });
  }
  for (const c of state.custom[dictName]) {
    out.push({ key: c.id, label: c.name, icon: c.icon || '🔖', items: c.items || [], custom: true });
  }
  return out;
}

// Info zu einer Kachel (auch versteckte Standards, für bestehende Listen)
function tileInfo(dictName, key) {
  const base = TILE_DICTS[dictName]();
  if (base[key]) {
    const ov = state.overrides[dictName][key] || {};
    return { label: ov.name || optName(base, key), icon: ov.icon || base[key].icon, items: base[key].items || [], custom: false };
  }
  const c = state.custom[dictName].find(x => x.id === key);
  return c ? { label: c.name, icon: c.icon || '🔖', items: c.items || [], custom: true } : null;
}

// ---- Listen-Erstellung aus Templates ----
function computeQty(def, days) {
  if (def === 'D') return Math.max(2, Math.min((days || 7) + 1, 10));
  return def;
}

function buildListItems(tripType, activities, transport, climate, days) {
  const keys = [];
  const push = (arr) => (arr || []).forEach(k => { if (!keys.includes(k)) keys.push(k); });
  const tt = tileInfo('tripTypes', tripType);
  push(tt ? tt.items : []);
  (activities || []).forEach(a => { const x = tileInfo('activities', a); push(x ? x.items : []); });
  (transport || []).forEach(tr => { const x = tileInfo('transport', tr); push(x ? x.items : []); });
  (climate || []).forEach(cl => push((CLIMATE[cl] || {}).items));
  return keys.filter(k => ITEMS[k]).map(k => {
    const def = ITEMS[k];
    return {
      id: uid(),
      k: k,             // Referenz auf Katalog-Artikel (für Sprachwechsel)
      n: null,          // eigener Name (nur bei Custom-Artikeln)
      c: def[0],
      q: computeQty(def[3], days),
      p: def[4],
      lm: false,        // Last-Minute nur manuell setzen, keine Defaults
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

// ---- Gewichtsschätzung ----
// Gewicht eines Listen-Artikels in Gramm pro Stück:
// Listen-Override > gespeicherte Korrektur > Custom-Artikel > Annahme
function itemWeight(li) {
  if (li.w != null) return li.w;
  if (li.k) {
    if (state.weights[li.k] != null) return state.weights[li.k];
    const ci = state.customItems.find(c => c.id === li.k);
    if (ci && ci.w != null) return ci.w;
    if (ITEM_WEIGHT[li.k] != null) return ITEM_WEIGHT[li.k];
  }
  return ITEM_WEIGHT_FALLBACK;
}

// Leergewicht eines Gepäckstücks in Gramm
function luggageWeight(key) {
  if (state.luggageWeights[key] != null) return state.luggageWeights[key];
  const c = state.custom.luggage.find(x => x.id === key);
  if (c && c.w != null) return c.w;
  return LUGGAGE_WEIGHT[key] != null ? LUGGAGE_WEIGHT[key] : LUGGAGE_WEIGHT_FALLBACK;
}

// Gesamtgewicht einer Liste: {items, luggage, total} in Gramm
function listWeights(list) {
  const items = list.items.reduce((s, li) => s + itemWeight(li) * li.q, 0);
  const luggage = (list.luggage || []).reduce((s, k) => s + luggageWeight(k), 0);
  return { items, luggage, total: items + luggage };
}

function fmtKg(g) {
  return (g / 1000).toFixed(1).replace('.', state.settings.lang === 'en' ? '.' : ',') + ' kg';
}

// ---- Final Check ----
// Liefert die Keys kritischer Artikel, die auf der Liste fehlen
function finalCheckMissing(list) {
  const have = new Set(list.items.map(i => i.k).filter(Boolean));
  const critical = new Set();
  const add = arr => (arr || []).forEach(k => critical.add(k));
  add(CRITICAL.always);
  add(CRITICAL.tripTypes[list.tripType]);
  (list.climate || []).forEach(c => add(CRITICAL.climate[c]));
  (list.transport || []).forEach(tr => add(CRITICAL.transport[tr]));
  (list.activities || []).forEach(a => add(CRITICAL.activities[a]));
  return [...critical].filter(k => ITEMS[k] && !have.has(k));
}

// ---- Rückreise-Checkliste ----
// Erzeugt die Checkliste beim ersten Öffnen (Basis + kontextabhängige Checks)
function ensureReturnChecks(list) {
  if (list.returnChecks) return;
  list.returnChecks = [];
  for (const key in RETURN_CHECKS) {
    const rc = RETURN_CHECKS[key];
    if (rc.cond && !(list.transport || []).includes(rc.cond)) continue;
    list.returnChecks.push({ id: uid(), k: key, n: null, done: false });
  }
  saveState();
}

function returnCheckName(rc) {
  if (rc.n) return rc.n;
  const def = RETURN_CHECKS[rc.k];
  return def ? (state.settings.lang === 'en' ? def.en : def.de) : rc.k;
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
