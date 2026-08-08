(() => {
  'use strict';
  const priceRows = [
    ['Iron Ore', 'Material · 46 signals', '1.0–1.4', '2–3', 'High'],
    ['Corundum Ore', 'Material · 21 signals', '4–5', '7–9', 'High'],
    ['Wheat', 'Ingredient · 9 signals', '1–2', '3–4', 'Medium'],
    ['Leather', 'Crafting material · 27 signals', '18–22', '25–30', 'High'],
    ['Fortify Health Potion', 'Potion · 6 signals', '22–28', '38–45', 'Medium'],
    ['Moonstone Ore', 'Material · 2 signals', '—', '15–21', 'Limited']
  ];
  const inventoryRows = [
    ['Iron Ore', 'Material', '6', '+4', '1.2', '2', 'Below minimum', 'low'],
    ['Corundum Ore', 'Material', '19', '—', '4.4', '8', 'Healthy', 'good'],
    ['Wheat', 'Ingredient', '31', '—', '1.0', '3', 'Healthy', 'good'],
    ['Leather', 'Crafting material', '42', '—', '19.5', '28', 'Fast moving', 'good'],
    ['Fortify Health Potion', 'Potion', '9', '+3', '23.0', '40', 'Watch', 'low'],
    ['Moonstone Ore', 'Material', '3', '—', '12.0', '18', 'Below minimum', 'low']
  ];
  const icon = (name) => name.includes('Potion') ? '✦' : name.includes('Leather') ? '◒' : name.includes('Wheat') ? '✤' : name.includes('Moonstone') ? '◈' : '◇';
  const renderPriceRows = (filter = '') => {
    const host = document.querySelector('#price-rows'); if (!host) return;
    const rows = priceRows.filter(r => r.join(' ').toLowerCase().includes(filter.toLowerCase()));
    host.innerHTML = rows.length ? rows.map(([name, type, pays, sells, confidence]) => `<tr data-item="${name}"><td><span class="item-name"><i class="table-icon">${icon(name)}</i><span><b>${name}</b><small>${type}</small></span></span></td><td class="rate">${pays} <small>septims</small></td><td class="rate">${sells} <small>septims</small></td><td><span class="confidence ${confidence === 'Limited' ? 'low' : ''}">${confidence}</span></td></tr>`).join('') : '<tr><td colspan="4" class="no-results">No catalog record matches that search.</td></tr>';
  };
  const renderInventoryRows = (filter = '') => {
    const host = document.querySelector('#inventory-rows'); if (!host) return;
    const rows = inventoryRows.filter(r => r.join(' ').toLowerCase().includes(filter.toLowerCase()));
    host.innerHTML = rows.length ? rows.map(([name, type, confirmed, pending, cost, sale, status, tone]) => `<tr data-item="${name}"><td><span class="item-name"><i class="table-icon">${icon(name)}</i><span><b>${name}</b><small>${type}</small></span></span></td><td class="rate">${confirmed}</td><td>${pending}</td><td class="rate">${cost} <small>each</small></td><td>${sale} <small>each</small></td><td><span class="status ${tone}">${status}</span></td></tr>`).join('') : '<tr><td colspan="6" class="no-results">Your shelves contain no matching item.</td></tr>';
  };
  const views = [...document.querySelectorAll('.view')];
  const showView = (requested) => {
    const view = ['login','public','dashboard','inventory','item'].includes(requested) ? requested : 'public';
    document.body.classList.toggle('is-login', view === 'login');
    document.body.classList.toggle('is-public', view === 'public');
    views.forEach(el => el.classList.toggle('visible', el.dataset.view === view));
    document.querySelectorAll('[data-view-link]').forEach(el => el.classList.toggle('active', el.dataset.viewLink === view));
    document.title = `SkyStore · ${view === 'public' ? 'Market Guide' : view[0].toUpperCase()+view.slice(1)}`;
    window.scrollTo({top: 0, behavior: 'instant'});
  };
  const handleHash = () => showView(location.hash.slice(1));
  document.querySelectorAll('[data-login]').forEach(btn => btn.addEventListener('click', () => { location.hash = 'public'; }));
  document.querySelector('#guide-search').addEventListener('input', e => renderPriceRows(e.target.value));
  document.querySelector('#inventory-search').addEventListener('input', e => renderInventoryRows(e.target.value));
  document.querySelector('#global-search').addEventListener('input', e => {
    const value = e.target.value.trim();
    if (value.length > 1) { location.hash = 'public'; document.querySelector('#guide-search').value = value; renderPriceRows(value); }
  });
  document.addEventListener('click', e => { const row = e.target.closest('tr[data-item]'); if (row) location.hash = 'item'; });
  const menu = document.querySelector('.menu-button');
  menu.addEventListener('click', () => { const open = document.querySelector('.mobile-nav').classList.toggle('open'); menu.setAttribute('aria-expanded', String(open)); });
  document.querySelectorAll('.mobile-nav a').forEach(a => a.addEventListener('click', () => { document.querySelector('.mobile-nav').classList.remove('open'); menu.setAttribute('aria-expanded', 'false'); }));
  const stateData = {
    loading: ['⌛', 'SYNCING THE LEDGER', 'Finding your records', 'The newest store data is being gathered. This will only take a moment.', 'Try again'],
    empty: ['◇', 'NO MATCHING RECORDS', 'Nothing rests on these shelves.', 'Try widening the search, selecting another category, or record the first completed trade.', 'Clear search'],
    low: ['!', 'SPARSE MARKET EVIDENCE', 'Not enough voices yet.', 'This item has signals from only two independent stores. Official Whiterun rates remain visible until the alliance threshold is met.', 'View official rule'],
    error: ['×', 'LEDGER UNAVAILABLE', 'The ink has run dry.', 'We could not retrieve this record. No trade or stock change has been made.', 'Try again']
  };
  const switcher = document.querySelector('#state-switcher');
  switcher.addEventListener('change', () => {
    const state = switcher.value;
    if (state === 'default') { handleHash(); return; }
    const [iconValue, kicker, title, copy, action] = stateData[state];
    document.querySelector('#state-icon').textContent = iconValue;
    document.querySelector('#state-kicker').textContent = kicker;
    document.querySelector('#state-title').textContent = title;
    document.querySelector('#state-copy').textContent = copy;
    document.querySelector('#state-action').textContent = action;
    views.forEach(el => el.classList.toggle('visible', el.dataset.view === 'state'));
  });
  document.querySelector('#state-action').addEventListener('click', () => { switcher.value = 'default'; handleHash(); });
  renderPriceRows(); renderInventoryRows();
  window.addEventListener('hashchange', () => { if (switcher.value === 'default') handleHash(); });
  handleHash();
})();
