// PackList – App-Logik und Views
let view = { name: 'home' };
let wiz = null;

const $app = document.getElementById('app');

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function applyTheme() {
  document.documentElement.setAttribute('data-theme', state.settings.theme);
  document.documentElement.lang = state.settings.lang;
}

function toast(msg) {
  document.querySelectorAll('.toast').forEach(e => e.remove());
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 2200);
}

function go(v) { view = v; render(); window.scrollTo(0, 0); }

function getList(id) { return state.lists.find(l => l.id === id); }

function locale() { return state.settings.lang === 'en' ? 'en-GB' : 'de-CH'; }

function fmtDate(d) {
  if (!d) return '';
  return new Date(d + 'T00:00:00').toLocaleDateString(locale(), { day: 'numeric', month: 'short', year: 'numeric' });
}

function fmtShort(d) {
  return new Date(d + 'T00:00:00').toLocaleDateString(locale(), { day: 'numeric', month: 'short' });
}

function localIso(dt) {
  return dt.getFullYear() + '-' + String(dt.getMonth() + 1).padStart(2, '0') + '-' + String(dt.getDate()).padStart(2, '0');
}

function listMeta(list) {
  const parts = [];
  if (list.dest) parts.push(esc(list.dest));
  if (list.dateFrom) parts.push(fmtDate(list.dateFrom) + (list.dateTo ? ' – ' + fmtDate(list.dateTo) : ''));
  const d = tripDays(list);
  if (d) parts.push(d + ' ' + (d === 1 ? t('day') : t('days')));
  return parts.join(' · ');
}

function daysToDeparture(list) {
  if (!list.dateFrom) return null;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  return Math.round((new Date(list.dateFrom + 'T00:00:00') - today) / 86400000);
}

// ================= RENDER =================
function render() {
  applyTheme();
  switch (view.name) {
    case 'home': renderHome(); break;
    case 'wizard': renderWizard(); break;
    case 'list': renderList(); break;
    case 'pack': renderPack(); break;
    case 'catalog': renderCatalog(); break;
    case 'settings': renderSettings(); break;
  }
}

// ---------------- Home ----------------
function renderHome() {
  let html = `<div class="topbar">
    <h1>🧳 ${t('appName')}</h1>
    <button class="iconbtn" data-act="catalog" title="${t('myItems')}">👕</button>
    <button class="iconbtn" data-act="settings" title="${t('settings')}">⚙️</button>
  </div>`;
  html += `<button class="btn" data-act="new-list">＋ ${t('newList')}</button>`;
  if (!state.lists.length) {
    html += `<div class="empty"><span class="emoji">🏝️</span>${t('noLists')}</div>`;
  } else {
    for (const l of state.lists) {
      const total = l.items.length;
      const packed = l.items.filter(i => i.packed).length;
      const tt = tileInfo('tripTypes', l.tripType);
      html += `<div class="card" data-act="open-list" data-id="${l.id}">
        <button class="card-menu" data-act="list-menu" data-id="${l.id}">⋯</button>
        <h3 style="padding-right:30px">${tt ? tt.icon + ' ' : ''}${esc(l.name)}</h3>
        <div class="meta">${listMeta(l)} · ${total} ${t('itemsCount')}</div>
        <div class="progressbar"><div style="width:${total ? Math.round(packed / total * 100) : 0}%"></div></div>
      </div>`;
    }
  }
  $app.innerHTML = html;
}

// ---------------- Wizard ----------------
const WIZ_STEPS = ['type', 'details', 'transport', 'luggage', 'climate', 'activities'];

function startWizard() {
  const now = new Date();
  wiz = {
    step: 0, tripType: null, dest: '', dateFrom: '', dateTo: '', name: '',
    transport: [], luggage: [], bagOption: 'carryon', climate: [], activities: [],
    calY: now.getFullYear(), calM: now.getMonth(),
  };
  go({ name: 'wizard' });
}

// Kacheln eines anpassbaren Screens (mit +-Kachel; lange drücken = bearbeiten)
function editableTilesHtml(dictName, selected, act, multi) {
  let h = '<div class="tiles">';
  for (const e of tileEntries(dictName)) {
    const sel = multi ? selected.includes(e.key) : selected === e.key;
    h += `<div class="tile ${sel ? 'sel' : ''}" data-act="${act}" data-key="${e.key}" data-dict="${dictName}">
      <span class="emoji">${e.icon}</span><span class="lbl">${esc(e.label)}</span></div>`;
  }
  h += `<div class="tile add-tile" data-act="tile-add" data-dict="${dictName}">
    <span class="emoji">＋</span><span class="lbl">${t('addTile')}</span></div>`;
  h += '</div>';
  h += `<div class="wiz-hint">${t('longPressHint')}</div>`;
  return h;
}

function tilesHtml(dict, selected, act, multi) {
  let h = '<div class="tiles">';
  for (const key in dict) {
    const o = dict[key];
    const sel = multi ? selected.includes(key) : selected === key;
    h += `<div class="tile ${sel ? 'sel' : ''}" data-act="${act}" data-key="${key}">
      <span class="emoji">${o.icon}</span><span class="lbl">${esc(optName(dict, key))}</span></div>`;
  }
  return h + '</div>';
}

function wizComputedDays() {
  if (wiz.dateFrom && wiz.dateTo) {
    return Math.round((new Date(wiz.dateTo) - new Date(wiz.dateFrom)) / 86400000) + 1;
  }
  return null;
}

function calendarHtml() {
  const y = wiz.calY, m = wiz.calM;
  const first = new Date(y, m, 1);
  const startDow = (first.getDay() + 6) % 7; // Montag = 0
  const dim = new Date(y, m + 1, 0).getDate();
  const title = first.toLocaleDateString(locale(), { month: 'long', year: 'numeric' });
  // 2024-01-01 war ein Montag → liefert lokalisierte Mo–So-Kürzel
  const dows = [...Array(7)].map((_, i) => new Date(2024, 0, 1 + i).toLocaleDateString(locale(), { weekday: 'short' }).slice(0, 2));
  let h = `<div class="cal">
    <div class="cal-head">
      <button data-act="cal-nav" data-d="-1">‹</button>
      <span class="cal-title">${title}</span>
      <button data-act="cal-nav" data-d="1">›</button>
    </div>
    <div class="cal-grid">${dows.map(d => `<div class="dow">${d}</div>`).join('')}`;
  for (let i = 0; i < startDow; i++) h += '<div></div>';
  const todayIso = localIso(new Date());
  for (let d = 1; d <= dim; d++) {
    const iso = y + '-' + String(m + 1).padStart(2, '0') + '-' + String(d).padStart(2, '0');
    const cls = ['cal-day'];
    if (iso === todayIso) cls.push('today');
    if (iso === wiz.dateFrom) cls.push('range-start');
    if (iso === wiz.dateTo) cls.push('range-end');
    if (wiz.dateFrom && wiz.dateTo && iso > wiz.dateFrom && iso < wiz.dateTo) cls.push('in-range');
    h += `<button class="${cls.join(' ')}" data-act="cal-day" data-iso="${iso}">${d}</button>`;
  }
  h += '</div>';
  let info = t('selectDates');
  const days = wizComputedDays();
  if (days) {
    info = `<b>${fmtShort(wiz.dateFrom)} – ${fmtShort(wiz.dateTo)}</b> · ${t('duration')}: <b>${days} ${days === 1 ? t('day') : t('days')}</b>`;
  } else if (wiz.dateFrom) {
    info = `<b>${fmtShort(wiz.dateFrom)}</b> – ?`;
  }
  h += `<div class="cal-info">${info}</div></div>`;
  return h;
}

function renderWizard() {
  const step = WIZ_STEPS[wiz.step];
  let html = `<div class="topbar">
    <button class="iconbtn" data-act="wiz-back">←</button>
    <h1>${t('newList')}</h1>
  </div>
  <div class="wiz-steps">${WIZ_STEPS.map((s, i) => `<div class="${i <= wiz.step ? 'done' : ''}"></div>`).join('')}</div>`;

  if (step === 'type') {
    html += `<div class="wiz-title">${t('wizTripType')}</div><div class="wiz-hint">${t('wizTripTypeHint')}</div>`;
    html += editableTilesHtml('tripTypes', wiz.tripType, 'wiz-type', false);
  } else if (step === 'details') {
    html += `<div class="wiz-title">${t('wizDetails')}</div>
      <div class="field"><label>${t('wizDest')}</label>
        <input id="w-dest" type="text" placeholder="${t('wizDestPh')}" value="${esc(wiz.dest)}"></div>
      ${calendarHtml()}
      <div class="field"><label>${t('wizListName')}</label>
        <input id="w-name" type="text" value="${esc(wiz.name)}" placeholder="${esc(defaultListName())}"></div>`;
  } else if (step === 'transport') {
    html += `<div class="wiz-title">${t('wizTransport')}</div><div class="wiz-hint">${t('wizTransportHint')}</div>`;
    html += editableTilesHtml('transport', wiz.transport, 'wiz-transport', true);
  } else if (step === 'luggage') {
    html += `<div class="wiz-title">${t('wizLuggage')}</div><div class="wiz-hint">${t('wizTransportHint')}</div>`;
    html += editableTilesHtml('luggage', wiz.luggage, 'wiz-luggage', true);
    if (wiz.transport.includes('flugzeug')) {
      html += `<div class="field"><label>${t('wizBagOption')}</label>
        <div class="seg">
          <button data-act="wiz-bag" data-key="carryon" class="${wiz.bagOption === 'carryon' ? 'sel' : ''}">${t('wizCarryOn')}</button>
          <button data-act="wiz-bag" data-key="checked" class="${wiz.bagOption === 'checked' ? 'sel' : ''}">${t('wizChecked')}</button>
        </div></div>`;
    }
  } else if (step === 'climate') {
    html += `<div class="wiz-title">${t('wizClimate')}</div><div class="wiz-hint">${t('wizClimateHint')}</div>`;
    html += tilesHtml(CLIMATE, wiz.climate, 'wiz-climate', true);
  } else if (step === 'activities') {
    html += `<div class="wiz-title">${t('wizActivities')}</div><div class="wiz-hint">${t('wizActivitiesHint')}</div>`;
    html += editableTilesHtml('activities', wiz.activities, 'wiz-activity', true);
  }

  const last = wiz.step === WIZ_STEPS.length - 1;
  const canNext = step !== 'type' || !!wiz.tripType;
  html += `<div style="height:70px"></div><div class="bottombar">
    <button class="btn" data-act="wiz-next" ${canNext ? '' : 'disabled'}>${last ? t('wizCreate') : t('next')}</button>
  </div>`;
  $app.innerHTML = html;
}

function defaultListName() {
  const parts = [];
  if (wiz.dest) parts.push(wiz.dest);
  else if (wiz.tripType) { const ti = tileInfo('tripTypes', wiz.tripType); if (ti) parts.push(ti.label); }
  const d = wizComputedDays();
  if (d) parts.push(d + ' ' + (d === 1 ? t('day') : t('days')));
  return parts.join(', ') || t('newList');
}

function wizReadDetails() {
  const g = id => document.getElementById(id);
  if (!g('w-dest')) return;
  wiz.dest = g('w-dest').value.trim();
  wiz.name = g('w-name').value.trim();
}

function wizNext() {
  if (WIZ_STEPS[wiz.step] === 'details') wizReadDetails();
  if (wiz.step < WIZ_STEPS.length - 1) { wiz.step++; render(); window.scrollTo(0, 0); return; }
  // Liste erstellen
  const days = wizComputedDays() || 7;
  const list = {
    id: uid(),
    name: wiz.name || defaultListName(),
    dest: wiz.dest,
    dateFrom: wiz.dateFrom, dateTo: wiz.dateTo,
    days: null,
    tripType: wiz.tripType,
    activities: wiz.activities,
    transport: wiz.transport,
    luggage: wiz.luggage,
    bagOption: wiz.transport.includes('flugzeug') ? wiz.bagOption : null,
    climate: wiz.climate,
    createdAt: new Date().toISOString(),
    items: buildListItems(wiz.tripType, wiz.activities, wiz.transport, wiz.climate, days),
  };
  state.lists.unshift(list);
  saveState();
  go({ name: 'list', id: list.id });
}

// ---------------- Kachel-Editor (lange drücken / +) ----------------
function tileEditModal(dictName, key) {
  const info = tileInfo(dictName, key);
  if (!info) return;
  showModal(`<h3>${t('editTile')}</h3>
    <div class="row2">
      <div class="field"><label>${t('tileName')}</label><input id="te-name" type="text" value="${esc(info.label)}"></div>
      <div class="field"><label>${t('tileIcon')}</label><input id="te-icon" type="text" value="${esc(info.icon)}" maxlength="4"></div>
    </div>
    <button class="btn" data-act="tile-edit-save" data-dict="${dictName}" data-key="${key}">${t('save')}</button>
    <button class="btn danger" data-act="tile-remove" data-dict="${dictName}" data-key="${key}">${t('remove')}</button>
    <button class="btn secondary" data-act="close-modal">${t('cancel')}</button>`);
}

function tileAddModal(dictName) {
  showModal(`<h3>＋ ${t('addTile')}</h3>
    <div class="row2">
      <div class="field"><label>${t('tileName')}</label><input id="te-name" type="text"></div>
      <div class="field"><label>${t('tileIcon')}</label><input id="te-icon" type="text" placeholder="🔖" maxlength="4"></div>
    </div>
    <button class="btn" data-act="tile-add-save" data-dict="${dictName}">${t('add')}</button>
    <button class="btn secondary" data-act="close-modal">${t('cancel')}</button>`);
}

function saveTileEdit(dictName, key) {
  const name = document.getElementById('te-name').value.trim();
  const icon = document.getElementById('te-icon').value.trim();
  if (!name) return;
  const custom = state.custom[dictName].find(c => c.id === key);
  if (custom) {
    custom.name = name; custom.icon = icon || custom.icon;
  } else {
    state.overrides[dictName][key] = Object.assign(state.overrides[dictName][key] || {}, { name, icon: icon || undefined });
  }
  saveState(); closeModal(); render();
}

function removeTile(dictName, key) {
  const idx = state.custom[dictName].findIndex(c => c.id === key);
  if (idx >= 0) state.custom[dictName].splice(idx, 1);
  else state.overrides[dictName][key] = Object.assign(state.overrides[dictName][key] || {}, { hidden: true });
  // Aus aktueller Wizard-Auswahl entfernen
  if (wiz) {
    if (wiz.tripType === key) wiz.tripType = null;
    ['transport', 'luggage', 'activities'].forEach(f => {
      const i = wiz[f].indexOf(key); if (i >= 0) wiz[f].splice(i, 1);
    });
  }
  saveState(); closeModal(); render();
}

function saveTileAdd(dictName) {
  const name = document.getElementById('te-name').value.trim();
  const icon = document.getElementById('te-icon').value.trim() || '🔖';
  if (!name) return;
  state.custom[dictName].push({ id: 'ct_' + uid(), name, icon, items: [] });
  saveState(); closeModal(); render();
}

// Lange drücken auf Kacheln (Touch + Maus) und Rechtsklick (Desktop)
let lpTimer = null, lpFired = false, lpStart = null;
document.addEventListener('pointerdown', e => {
  const tile = e.target.closest('.tile[data-dict]');
  if (!tile) return;
  lpFired = false;
  lpStart = { x: e.clientX, y: e.clientY };
  lpTimer = setTimeout(() => {
    lpFired = true;
    tileEditModal(tile.dataset.dict, tile.dataset.key);
  }, 500);
});
document.addEventListener('pointermove', e => {
  if (lpTimer && lpStart && Math.hypot(e.clientX - lpStart.x, e.clientY - lpStart.y) > 12) {
    clearTimeout(lpTimer); lpTimer = null;
  }
});
['pointerup', 'pointercancel'].forEach(ev => document.addEventListener(ev, () => {
  if (lpTimer) { clearTimeout(lpTimer); lpTimer = null; }
}));
document.addEventListener('contextmenu', e => {
  const tile = e.target.closest('.tile[data-dict]');
  if (tile) { e.preventDefault(); tileEditModal(tile.dataset.dict, tile.dataset.key); }
});

// ---------------- List (Editor) ----------------
function groupByCat(items) {
  const groups = {};
  for (const it of items) {
    const c = (CATS[it.c] || state.customCats.find(x => x.id === it.c)) ? it.c : 'sonstiges';
    (groups[c] = groups[c] || []).push(it);
  }
  const order = allCatIds();
  return Object.keys(groups)
    .sort((a, b) => order.indexOf(a) - order.indexOf(b))
    .map(c => ({ cat: c, items: groups[c] }));
}

function renderList() {
  const list = getList(view.id);
  if (!list) return go({ name: 'home' });
  const total = list.items.length, packed = list.items.filter(i => i.packed).length;
  let html = `<div class="topbar">
    <button class="iconbtn" data-act="home">←</button>
    <div style="flex:1;min-width:0"><h1>${esc(list.name)}</h1><div class="sub">${listMeta(list)}</div></div>
    <button class="iconbtn" data-act="list-menu" data-id="${list.id}">⋯</button>
  </div>`;
  html += `<div class="legend">
    <span><i style="background:var(--prio1)"></i>${t('prio1')}</span>
    <span><i style="background:var(--prio2)"></i>${t('prio2')}</span>
    <span><i style="background:var(--prio3)"></i>${t('prio3')}</span>
  </div>`;
  for (const g of groupByCat(list.items)) {
    html += `<div class="cat-section"><div class="cat-head">${catIcon(g.cat)} ${esc(catName(g.cat))} <span class="count">(${g.items.length})</span>
      <button class="cat-add" data-act="add-item-cat" data-cat="${g.cat}" title="${t('addItem')}">＋</button></div>`;
    for (const it of g.items) {
      html += `<div class="item">
        <div class="prio-dot" data-p="${it.p}" data-act="cycle-prio" data-id="${it.id}" title="${t('priority')}"></div>
        <div class="name" data-act="edit-item" data-id="${it.id}">${esc(listItemName(it))}${it.lm ? ' <span class="lm-badge">⏰ LM</span>' : ''}</div>
        <div class="qty">
          <button data-act="qty" data-id="${it.id}" data-d="-1">−</button>
          <span>${it.q}</span>
          <button data-act="qty" data-id="${it.id}" data-d="1">＋</button>
        </div>
        <button class="del" data-act="del-item" data-id="${it.id}">✕</button>
      </div>`;
    }
    html += `</div>`;
  }
  html += `<button class="btn secondary" data-act="add-item">＋ ${t('addItem')}</button>
    <button class="btn secondary" data-act="add-cat">＋ ${t('addCategory')}</button>
    <div style="height:10px"></div>
    <div class="bottombar"><button class="btn" data-act="pack-mode">🎒 ${t('packMode')} (${packed}/${total})</button></div>`;
  $app.innerHTML = html;
}

function cyclePrio(list, id) {
  const it = list.items.find(i => i.id === id);
  if (it) { it.p = it.p % 3 + 1; saveState(); render(); }
}

function changeQty(list, id, d) {
  const it = list.items.find(i => i.id === id);
  if (it) { it.q = Math.max(1, it.q + d); saveState(); render(); }
}

// ---------------- Add/Edit Item Modal ----------------
function showModal(inner) {
  closeModal();
  const bg = document.createElement('div');
  bg.className = 'modal-bg';
  bg.innerHTML = `<div class="modal">${inner}</div>`;
  bg.addEventListener('click', e => { if (e.target === bg) closeModal(); });
  document.body.appendChild(bg);
}
function closeModal() { document.querySelectorAll('.modal-bg').forEach(e => e.remove()); }

function catSelectHtml(id, selected) {
  let h = `<select id="${id}">`;
  for (const c of allCatIds()) h += `<option value="${c}" ${c === selected ? 'selected' : ''}>${catIcon(c)} ${esc(catName(c))}</option>`;
  return h + '</select>';
}

function prioSelectHtml(id, selected) {
  let h = `<select id="${id}">`;
  for (const p of [1, 2, 3]) h += `<option value="${p}" ${p === selected ? 'selected' : ''}>${t('prio' + p)}</option>`;
  return h + '</select>';
}

// tab: 'catalog' | 'new'; onlyCat: optional Kategorie-Filter (über Kategorie-＋)
function addItemModal(listId, tab, onlyCat) {
  tab = tab || 'catalog';
  const list = getList(listId);
  const catAttr = onlyCat ? `data-cat="${onlyCat}"` : '';
  let inner = `<h3>${t('addItem')}${onlyCat ? ' – ' + catIcon(onlyCat) + ' ' + esc(catName(onlyCat)) : ''}</h3>
    <div class="seg" style="margin-bottom:12px">
      <button class="${tab === 'catalog' ? 'sel' : ''}" data-act="additem-tab" data-key="catalog" data-list="${listId}" ${catAttr}>${t('fromCatalog')}</button>
      <button class="${tab === 'new' ? 'sel' : ''}" data-act="additem-tab" data-key="new" data-list="${listId}" ${catAttr}>${t('newItem')}</button>
    </div>`;
  if (tab === 'catalog') {
    const inList = new Set(list.items.map(i => i.k).filter(Boolean));
    // Eigene Artikel zuoberst
    const ownItems = state.customItems.filter(ci => !onlyCat || ci.cat === onlyCat);
    if (ownItems.length) {
      inner += `<div class="cat-head" style="margin-top:8px">⭐ ${t('customItems')}</div><div class="tiles">`;
      for (const ci of ownItems) {
        const sel = inList.has(ci.id);
        inner += `<div class="tile ${sel ? 'sel' : ''}" data-act="pick-item" data-list="${listId}" data-key="${ci.id}">
          <span class="emoji">${catIcon(ci.cat)}</span><span class="lbl">${esc(ci.name)}</span></div>`;
      }
      inner += '</div>';
    }
    for (const c of allCatIds()) {
      if (onlyCat && c !== onlyCat) continue;
      const keys = Object.keys(ITEMS).filter(k => ITEMS[k][0] === c);
      if (!keys.length) continue;
      inner += `<div class="cat-head" style="margin-top:8px">${catIcon(c)} ${esc(catName(c))}</div><div class="tiles">`;
      for (const k of keys) {
        const sel = inList.has(k);
        inner += `<div class="tile ${sel ? 'sel' : ''}" data-act="pick-item" data-list="${listId}" data-key="${k}">
          <span class="emoji">${itemEmoji(k, c)}</span><span class="lbl">${esc(itemDefName(k))}</span></div>`;
      }
      inner += '</div>';
    }
    inner += `<button class="btn secondary" data-act="close-modal">${t('done')}</button>`;
  } else {
    inner += `
      <div class="field"><label>${t('itemName')}</label><input id="ni-name" type="text" placeholder="${t('itemNamePh')}"></div>
      <div class="row2">
        <div class="field"><label>${t('category')}</label>${catSelectHtml('ni-cat', onlyCat || 'sonstiges')}</div>
        <div class="field"><label>${t('quantity')}</label><input id="ni-qty" type="number" min="1" value="1" inputmode="numeric"></div>
      </div>
      <div class="field"><label>${t('priority')}</label>${prioSelectHtml('ni-prio', 2)}</div>
      <div class="field"><label><input type="checkbox" id="ni-lm" style="width:auto"> ${t('lastMinute')}</label></div>
      <div class="field"><label><input type="checkbox" id="ni-save" style="width:auto" checked> ${t('saveToCatalog')}</label></div>
      <button class="btn" data-act="new-item-save" data-list="${listId}">${t('add')}</button>
      <button class="btn secondary" data-act="close-modal">${t('cancel')}</button>`;
  }
  showModal(inner);
}

function pickItem(listId, key, tileEl) {
  const list = getList(listId);
  const existing = list.items.find(i => i.k === key);
  if (existing) {
    list.items = list.items.filter(i => i.k !== key);
    tileEl.classList.remove('sel');
  } else {
    const def = ITEMS[key];
    const ci = state.customItems.find(c => c.id === key);
    const days = tripDays(list);
    list.items.push({
      id: uid(), k: key, n: ci ? ci.name : null,
      c: def ? def[0] : ci.cat,
      q: def ? computeQty(def[3], days) : (ci.defQty || 1),
      p: def ? def[4] : (ci.prio || 2),
      lm: def ? false : !!ci.lastMinute,
      packed: false,
    });
    tileEl.classList.add('sel');
  }
  saveState();
}

function saveNewItem(listId) {
  const name = document.getElementById('ni-name').value.trim();
  if (!name) return;
  const cat = document.getElementById('ni-cat').value;
  const qty = Math.max(1, parseInt(document.getElementById('ni-qty').value, 10) || 1);
  const prio = parseInt(document.getElementById('ni-prio').value, 10);
  const lm = document.getElementById('ni-lm') ? document.getElementById('ni-lm').checked : false;
  const saveCat = document.getElementById('ni-save').checked;
  let key = null;
  if (saveCat) {
    const ci = { id: uid(), name, cat, defQty: qty, prio, lastMinute: lm };
    state.customItems.push(ci);
    key = ci.id;
  }
  if (listId) {
    const list = getList(listId);
    list.items.push({ id: uid(), k: key, n: name, c: cat, q: qty, p: prio, lm, packed: false });
  }
  saveState();
  closeModal();
  render();
  toast(t('saved'));
}

function editItemModal(listId, itemId) {
  const list = getList(listId);
  const it = list.items.find(i => i.id === itemId);
  if (!it) return;
  const isCustomRef = it.k && state.customItems.some(c => c.id === it.k);
  showModal(`<h3>${t('editItem')}</h3>
    <div class="field"><label>${t('itemName')}</label><input id="ei-name" type="text" value="${esc(listItemName(it))}"></div>
    <div class="row2">
      <div class="field"><label>${t('category')}</label>${catSelectHtml('ei-cat', it.c)}</div>
      <div class="field"><label>${t('quantity')}</label><input id="ei-qty" type="number" min="1" value="${it.q}" inputmode="numeric"></div>
    </div>
    <div class="field"><label>${t('priority')}</label>${prioSelectHtml('ei-prio', it.p)}</div>
    <div class="field"><label><input type="checkbox" id="ei-lm" style="width:auto" ${it.lm ? 'checked' : ''}> ${t('lastMinute')}</label></div>
    <div class="field"><label><input type="checkbox" id="ei-save" style="width:auto" ${isCustomRef || it.n ? 'checked' : ''}> ${t('saveToCatalog')}</label></div>
    <button class="btn" data-act="edit-item-save" data-list="${listId}" data-id="${itemId}">${t('save')}</button>
    <button class="btn secondary" data-act="close-modal">${t('cancel')}</button>`);
}

function saveEditItem(listId, itemId) {
  const list = getList(listId);
  const it = list.items.find(i => i.id === itemId);
  const name = document.getElementById('ei-name').value.trim();
  if (name && name !== listItemName(it)) { it.n = name; }
  it.c = document.getElementById('ei-cat').value;
  it.q = Math.max(1, parseInt(document.getElementById('ei-qty').value, 10) || 1);
  it.p = parseInt(document.getElementById('ei-prio').value, 10);
  it.lm = document.getElementById('ei-lm').checked;
  // Bearbeitete Artikel optional in "Meine Artikel" übernehmen/aktualisieren
  if (document.getElementById('ei-save').checked) {
    const existing = it.k && state.customItems.find(c => c.id === it.k);
    if (existing) {
      existing.name = listItemName(it); existing.cat = it.c;
      existing.defQty = it.q; existing.prio = it.p; existing.lastMinute = it.lm;
    } else {
      const ci = { id: uid(), name: listItemName(it), cat: it.c, defQty: it.q, prio: it.p, lastMinute: it.lm };
      state.customItems.push(ci);
      it.k = ci.id;
    }
  }
  saveState();
  closeModal();
  render();
}

function addCatModal() {
  showModal(`<h3>${t('newCategory')}</h3>
    <div class="row2">
      <div class="field"><label>${t('catName')}</label><input id="nc-name" type="text"></div>
      <div class="field"><label>${t('catIcon')}</label><input id="nc-icon" type="text" placeholder="🧷" maxlength="4"></div>
    </div>
    <button class="btn" data-act="new-cat-save">${t('add')}</button>
    <button class="btn secondary" data-act="close-modal">${t('cancel')}</button>`);
}

function saveNewCat() {
  const name = document.getElementById('nc-name').value.trim();
  if (!name) return;
  const icon = document.getElementById('nc-icon').value.trim() || '📦';
  state.customCats.push({ id: 'cc_' + uid(), name, icon });
  saveState();
  closeModal();
  render();
  toast(t('saved'));
}

// ---------------- List-Menü / Teilen ----------------
function listMenuModal(listId) {
  showModal(`<h3>${esc(getList(listId).name)}</h3>
    <button class="btn secondary" data-act="rename-list" data-id="${listId}">✏️ ${t('rename')}</button>
    <button class="btn secondary" data-act="duplicate-list" data-id="${listId}">📋 ${t('duplicate')}</button>
    <button class="btn secondary" data-act="share-list" data-id="${listId}">📤 ${t('share')}</button>
    <button class="btn secondary" data-act="reset-packing" data-id="${listId}">↩️ ${t('resetPacking')}</button>
    <button class="btn danger" data-act="delete-list" data-id="${listId}">🗑 ${t('deleteList')}</button>
    <button class="btn secondary" data-act="close-modal">${t('cancel')}</button>`);
}

function b64encode(obj) {
  const bytes = new TextEncoder().encode(JSON.stringify(obj));
  let bin = '';
  bytes.forEach(b => bin += String.fromCharCode(b));
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function b64decode(s) {
  s = s.replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(s);
  const bytes = new Uint8Array([...bin].map(c => c.charCodeAt(0)));
  return JSON.parse(new TextDecoder().decode(bytes));
}

async function shareList(listId) {
  const list = getList(listId);
  const payload = exportListPayload(list);
  const fname = list.name.replace(/[^\wäöüÄÖÜ\- ]/g, '').replace(/ +/g, '_') + '.packlist.json';
  const file = new File([JSON.stringify(payload, null, 2)], fname, { type: 'application/json' });
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try { await navigator.share({ files: [file], title: list.name }); return; } catch (e) { /* abgebrochen */ }
  } else {
    downloadFile(fname, JSON.stringify(payload, null, 2));
  }
}

function shareListLink(listId) {
  const payload = exportListPayload(getList(listId));
  const url = location.origin + location.pathname + '#share=' + b64encode(payload);
  navigator.clipboard.writeText(url).then(() => toast(t('linkCopied')));
}

function shareModal(listId) {
  showModal(`<h3>${t('shareList')}</h3>
    <button class="btn" data-act="share-file" data-id="${listId}">📄 ${t('shareAsFile')}</button>
    <button class="btn secondary" data-act="share-link" data-id="${listId}">🔗 ${t('shareAsLink')}</button>
    <button class="btn secondary" data-act="close-modal">${t('cancel')}</button>`);
}

function downloadFile(name, content) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([content], { type: 'application/json' }));
  a.download = name;
  a.click();
  URL.revokeObjectURL(a.href);
  toast(t('exported'));
}

// ---------------- Packing-Modus ----------------
let packFilter = 'open';

function renderPack() {
  const list = getList(view.id);
  if (!list) return go({ name: 'home' });
  const total = list.items.length, packed = list.items.filter(i => i.packed).length;
  const pct = total ? Math.round(packed / total * 100) : 0;
  let html = `<div class="topbar">
    <button class="iconbtn" data-act="back-to-list" data-id="${list.id}">←</button>
    <div style="flex:1;min-width:0"><h1>🎒 ${esc(list.name)}</h1>
    <div class="sub">${packed}/${total} ${t('packProgress')} (${pct}%)</div></div>
  </div>
  <div class="progressbar" style="height:8px"><div style="width:${pct}%"></div></div>`;

  // Abreise-Banner mit Last-Minute-Artikeln
  const dtd = daysToDeparture(list);
  const lmOpen = list.items.filter(i => i.lm && !i.packed);
  if (dtd !== null && dtd <= 1 && dtd >= 0 && lmOpen.length) {
    html += `<div class="banner"><b>${dtd === 0 ? t('departureToday') : t('departureSoon', { n: dtd })}</b><br>
      ${t('lastMinuteBanner')}<br>• ${lmOpen.map(i => esc(listItemName(i))).join('<br>• ')}</div>`;
  } else if (lmOpen.length) {
    html += `<div class="banner info"><b>⏰ ${t('lastMinuteTitle')}</b><br>• ${lmOpen.map(i => esc(listItemName(i))).join('<br>• ')}</div>`;
  }

  html += `<div class="seg" style="margin:12px 0">
    <button class="${packFilter === 'open' ? 'sel' : ''}" data-act="pack-filter" data-key="open">${t('showOpen')} (${total - packed})</button>
    <button class="${packFilter === 'all' ? 'sel' : ''}" data-act="pack-filter" data-key="all">${t('showAll')} (${total})</button>
  </div>`;

  const items = packFilter === 'open' ? list.items.filter(i => !i.packed) : list.items;
  if (!items.length && packed === total && total > 0) {
    html += `<div class="empty"><span class="emoji">✅</span>${t('allPacked')}</div>`;
  }
  for (const g of groupByCat(items)) {
    html += `<div class="cat-section"><div class="cat-head">${catIcon(g.cat)} ${esc(catName(g.cat))}</div>`;
    for (const it of g.items) {
      html += `<div class="pack-item ${it.packed ? 'packed' : ''}" data-act="toggle-pack" data-id="${it.id}">
        <div class="check">${it.packed ? '✓' : ''}</div>
        <div class="name">${esc(listItemName(it))}${it.lm ? ' <span class="lm-badge" style="color:var(--danger);font-size:11px;font-weight:700">⏰</span>' : ''}</div>
        ${it.q > 1 ? `<span class="qty-badge">${it.q}×</span>` : ''}
        <div class="prio-dot" style="background:var(--prio${it.p})"></div>
      </div>`;
    }
    html += `</div>`;
  }
  $app.innerHTML = html;
}

// ---------------- Katalog (Meine Artikel) ----------------
function renderCatalog() {
  let html = `<div class="topbar">
    <button class="iconbtn" data-act="home">←</button>
    <h1>👕 ${t('myItems')}</h1>
  </div>
  <div class="wiz-hint">${t('catalogHint')}</div>
  <button class="btn" data-act="catalog-add">＋ ${t('newItem')}</button>`;
  if (!state.customItems.length) {
    html += `<div class="empty"><span class="emoji">🧦</span>${t('customItems')}: 0</div>`;
  } else {
    const groups = {};
    state.customItems.forEach(ci => (groups[ci.cat] = groups[ci.cat] || []).push(ci));
    for (const c of allCatIds()) {
      if (!groups[c]) continue;
      html += `<div class="cat-section"><div class="cat-head">${catIcon(c)} ${esc(catName(c))}</div>`;
      for (const ci of groups[c]) {
        html += `<div class="item">
          <div class="prio-dot" data-p="${ci.prio || 2}"></div>
          <div class="name" data-act="catalog-edit" data-id="${ci.id}">${esc(ci.name)}${ci.lastMinute ? ' <span class="lm-badge">⏰ LM</span>' : ''}</div>
          <span style="color:var(--text-soft);font-size:14px">${ci.defQty || 1}×</span>
          <button class="del" data-act="catalog-del" data-id="${ci.id}">✕</button>
        </div>`;
      }
      html += '</div>';
    }
  }
  $app.innerHTML = html;
}

function catalogEditModal(id) {
  const ci = state.customItems.find(c => c.id === id);
  if (!ci) return;
  showModal(`<h3>${t('editItem')}</h3>
    <div class="field"><label>${t('itemName')}</label><input id="ce-name" type="text" value="${esc(ci.name)}"></div>
    <div class="row2">
      <div class="field"><label>${t('category')}</label>${catSelectHtml('ce-cat', ci.cat)}</div>
      <div class="field"><label>${t('defaultQty')}</label><input id="ce-qty" type="number" min="1" value="${ci.defQty || 1}" inputmode="numeric"></div>
    </div>
    <div class="field"><label>${t('priority')}</label>${prioSelectHtml('ce-prio', ci.prio || 2)}</div>
    <div class="field"><label><input type="checkbox" id="ce-lm" style="width:auto" ${ci.lastMinute ? 'checked' : ''}> ${t('lastMinute')}</label></div>
    <button class="btn" data-act="catalog-edit-save" data-id="${id}">${t('save')}</button>
    <button class="btn secondary" data-act="close-modal">${t('cancel')}</button>`);
}

function catalogAddModal() {
  showModal(`<h3>${t('newItem')}</h3>
    <div class="field"><label>${t('itemName')}</label><input id="ni-name" type="text" placeholder="${t('itemNamePh')}"></div>
    <div class="row2">
      <div class="field"><label>${t('category')}</label>${catSelectHtml('ni-cat', 'kleider')}</div>
      <div class="field"><label>${t('defaultQty')}</label><input id="ni-qty" type="number" min="1" value="1" inputmode="numeric"></div>
    </div>
    <div class="field"><label>${t('priority')}</label>${prioSelectHtml('ni-prio', 2)}</div>
    <div class="field"><label><input type="checkbox" id="ni-lm" style="width:auto"> ${t('lastMinute')}</label></div>
    <input type="checkbox" id="ni-save" checked hidden>
    <button class="btn" data-act="new-item-save" data-list="">${t('add')}</button>
    <button class="btn secondary" data-act="close-modal">${t('cancel')}</button>`);
}

// ---------------- Settings ----------------
function renderSettings() {
  const s = state.settings;
  const cname = c => COUNTRY_NAMES[c] ? (s.lang === 'en' ? COUNTRY_NAMES[c].en : COUNTRY_NAMES[c].de) : c;
  let html = `<div class="topbar">
    <button class="iconbtn" data-act="home">←</button>
    <h1>⚙️ ${t('settings')}</h1>
  </div>
  <div class="field"><label>${t('language')}</label>
    <div class="seg">
      <button data-act="set-lang" data-key="de" class="${s.lang === 'de' ? 'sel' : ''}">Deutsch</button>
      <button data-act="set-lang" data-key="en" class="${s.lang === 'en' ? 'sel' : ''}">English</button>
    </div></div>
  <div class="field"><label>${t('theme')}</label>
    <div class="seg">
      <button data-act="set-theme" data-key="light" class="${s.theme === 'light' ? 'sel' : ''}">☀️ ${t('themeLight')}</button>
      <button data-act="set-theme" data-key="dark" class="${s.theme === 'dark' ? 'sel' : ''}">🌙 ${t('themeDark')}</button>
      <button data-act="set-theme" data-key="system" class="${s.theme === 'system' ? 'sel' : ''}">${t('themeSystem')}</button>
    </div></div>
  <div class="field"><label>${t('homeCountry')} · ${t('homeCountryHint')}</label>
    <select id="set-country">${COUNTRIES.map(c => `<option value="${c}" ${c === s.homeCountry ? 'selected' : ''}>${esc(cname(c))}</option>`).join('')}</select>
  </div>
  <button class="btn secondary" data-act="export-backup">💾 ${t('exportData')}</button>
  <button class="btn secondary" data-act="import-trigger">📥 ${t('importData')}</button>
  <input type="file" id="import-file" accept=".json,application/json" hidden>
  <div class="wiz-hint" style="margin-top:20px">${t('version')} ${APP_VERSION}</div>`;
  $app.innerHTML = html;
  document.getElementById('set-country').addEventListener('change', e => {
    state.settings.homeCountry = e.target.value; saveState();
  });
  document.getElementById('import-file').addEventListener('change', handleImportFile);
}

function handleImportFile(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const payload = JSON.parse(reader.result);
      if (payload.type === 'packlist-backup' && !confirm(t('importConfirm'))) return;
      const res = importPayload(payload);
      toast(res === 'backup' ? t('imported') : t('listImported'));
      go({ name: 'home' });
    } catch (err) {
      toast(t('importError'));
    }
  };
  reader.readAsText(file);
}

// ---------------- Import über Share-Link ----------------
function checkShareHash() {
  if (location.hash.startsWith('#share=')) {
    try {
      const payload = b64decode(location.hash.slice(7));
      history.replaceState(null, '', location.pathname);
      if (payload.type === 'packlist-list' && confirm(t('importListQ', { name: payload.list.name }))) {
        const list = importPayload(payload);
        toast(t('listImported'));
        go({ name: 'list', id: list.id });
        return true;
      }
    } catch (e) { console.warn('share import failed', e); }
  }
  return false;
}

// ================= EVENTS =================
document.addEventListener('click', e => {
  if (lpFired) { lpFired = false; return; } // Klick nach Long-Press unterdrücken
  const el = e.target.closest('[data-act]');
  if (!el) return;
  const act = el.dataset.act, id = el.dataset.id, key = el.dataset.key;
  const list = view.id ? getList(view.id) : null;
  switch (act) {
    case 'home': go({ name: 'home' }); break;
    case 'settings': go({ name: 'settings' }); break;
    case 'catalog': go({ name: 'catalog' }); break;
    case 'new-list': startWizard(); break;
    case 'open-list': go({ name: 'list', id }); break;
    // Wizard
    case 'wiz-back':
      if (WIZ_STEPS[wiz.step] === 'details') wizReadDetails();
      if (wiz.step === 0) go({ name: 'home' }); else { wiz.step--; render(); }
      break;
    case 'wiz-next': wizNext(); break;
    case 'wiz-type': wiz.tripType = key; render(); break;
    case 'wiz-transport': toggleArr(wiz.transport, key); render(); break;
    case 'wiz-luggage': toggleArr(wiz.luggage, key); render(); break;
    case 'wiz-climate': toggleArr(wiz.climate, key); render(); break;
    case 'wiz-activity': toggleArr(wiz.activities, key); render(); break;
    case 'wiz-bag': wiz.bagOption = key; render(); break;
    // Kalender
    case 'cal-nav': {
      wizReadDetails();
      let m = wiz.calM + parseInt(el.dataset.d, 10);
      if (m < 0) { m = 11; wiz.calY--; } else if (m > 11) { m = 0; wiz.calY++; }
      wiz.calM = m; render(); break;
    }
    case 'cal-day': {
      wizReadDetails();
      const iso = el.dataset.iso;
      if (!wiz.dateFrom || (wiz.dateFrom && wiz.dateTo)) { wiz.dateFrom = iso; wiz.dateTo = ''; }
      else if (iso < wiz.dateFrom) { wiz.dateFrom = iso; }
      else { wiz.dateTo = iso; }
      render(); break;
    }
    // Kachel-Editor
    case 'tile-add': tileAddModal(el.dataset.dict); break;
    case 'tile-add-save': saveTileAdd(el.dataset.dict); break;
    case 'tile-edit-save': saveTileEdit(el.dataset.dict, el.dataset.key); break;
    case 'tile-remove': removeTile(el.dataset.dict, el.dataset.key); break;
    // List editor
    case 'cycle-prio': cyclePrio(list, id); break;
    case 'qty': changeQty(list, id, parseInt(el.dataset.d, 10)); break;
    case 'del-item': list.items = list.items.filter(i => i.id !== id); saveState(); render(); break;
    case 'edit-item': editItemModal(view.id, id); break;
    case 'edit-item-save': saveEditItem(el.dataset.list, id); break;
    case 'add-item': addItemModal(view.id); break;
    case 'add-item-cat': addItemModal(view.id, 'new', el.dataset.cat); break;
    case 'additem-tab': addItemModal(el.dataset.list, key, el.dataset.cat); break;
    case 'pick-item': pickItem(el.dataset.list, key, el); break;
    case 'new-item-save': saveNewItem(el.dataset.list || null); break;
    case 'add-cat': addCatModal(); break;
    case 'new-cat-save': saveNewCat(); break;
    case 'list-menu': listMenuModal(id); break;
    case 'rename-list': {
      const l = getList(id);
      const name = prompt(t('wizListName'), l.name);
      if (name && name.trim()) { l.name = name.trim(); saveState(); }
      closeModal(); render(); break;
    }
    case 'duplicate-list': {
      const l = getList(id);
      const copy = JSON.parse(JSON.stringify(l));
      copy.id = uid(); copy.name += ' (2)';
      copy.items.forEach(i => { i.id = uid(); i.packed = false; });
      state.lists.unshift(copy); saveState(); closeModal();
      go({ name: 'list', id: copy.id }); toast(t('duplicated')); break;
    }
    case 'share-list': closeModal(); shareModal(id); break;
    case 'share-file': closeModal(); shareList(id); break;
    case 'share-link': closeModal(); shareListLink(id); break;
    case 'reset-packing': getList(id).items.forEach(i => i.packed = false); saveState(); closeModal(); render(); break;
    case 'delete-list':
      if (confirm(t('deleteListConfirm'))) {
        state.lists = state.lists.filter(l => l.id !== id);
        saveState(); closeModal();
        if (view.name === 'home') render(); else go({ name: 'home' });
        toast(t('deleted'));
      }
      break;
    // Packing
    case 'pack-mode': go({ name: 'pack', id: view.id }); break;
    case 'back-to-list': go({ name: 'list', id }); break;
    case 'pack-filter': packFilter = key; render(); break;
    case 'toggle-pack': {
      const it = list.items.find(i => i.id === id);
      it.packed = !it.packed; saveState(); render(); break;
    }
    // Catalog
    case 'catalog-add': catalogAddModal(); break;
    case 'catalog-edit': catalogEditModal(id); break;
    case 'catalog-edit-save': {
      const ci = state.customItems.find(c => c.id === id);
      ci.name = document.getElementById('ce-name').value.trim() || ci.name;
      ci.cat = document.getElementById('ce-cat').value;
      ci.defQty = Math.max(1, parseInt(document.getElementById('ce-qty').value, 10) || 1);
      ci.prio = parseInt(document.getElementById('ce-prio').value, 10);
      ci.lastMinute = document.getElementById('ce-lm').checked;
      saveState(); closeModal(); render(); toast(t('saved')); break;
    }
    case 'catalog-del':
      state.customItems = state.customItems.filter(c => c.id !== id);
      saveState(); render(); break;
    // Settings
    case 'set-lang': state.settings.lang = key; saveState(); render(); break;
    case 'set-theme': state.settings.theme = key; saveState(); render(); break;
    case 'export-backup': downloadFile('packlist_backup.json', JSON.stringify(exportBackupPayload(), null, 2)); break;
    case 'import-trigger': document.getElementById('import-file').click(); break;
    case 'close-modal': closeModal(); render(); break;
  }
});

function toggleArr(arr, key) {
  const i = arr.indexOf(key);
  if (i >= 0) arr.splice(i, 1); else arr.push(key);
}

// Start
applyTheme();
if (!checkShareHash()) render();
