/* FIELDNOTE static dashboard: reads window.FIELDNOTE, no network. */
(function () {
'use strict';

var DATA = window.FIELDNOTE;
var root = document.getElementById('board');
if (!DATA || !root) return;

var PAGE_SIZE = 25;
var state = {
q: '',
category: 'all',
chain: 'all',
confidence: 'all',
status: 'no-token',
watchlist: false,
sort: 'rank',
dir: 1,
page: 1,
selected: null
};

var usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
function fmtUsd(n) {
if (n === null || n === undefined || !isFinite(n)) return 'n/a';
if (Math.abs(n) >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B';
if (Math.abs(n) >= 1e6) return '$' + (n / 1e6).toFixed(1) + 'M';
if (Math.abs(n) >= 1e3) return '$' + Math.round(n / 1e3) + 'K';
return usd.format(n);
}
function fmtFullUsd(n) {
if (n === null || n === undefined || !isFinite(n)) return 'n/a';
return usd.format(Math.round(n));
}
function fmtPct(n) {
if (n === null || n === undefined || !isFinite(n)) return 'n/a';
return (n > 0 ? '+' : '') + n.toFixed(2) + '%';
}
function fmtAge(days) {
if (days === null || days === undefined) return 'unknown';
if (days >= 730) return (days / 365).toFixed(1) + 'y';
if (days >= 365) return '1y';
return Math.max(0, Math.round(days)) + 'd';
}
function fmtRatio(n) {
if (n === null || n === undefined || !isFinite(n)) return 'n/a';
return n.toFixed(2) + 'x';
}
function fmtInt(n) {
return Math.round(n).toLocaleString('en-US');
}
function el(tag, attrs) {
var node = document.createElement(tag);
if (attrs) {
Object.keys(attrs).forEach(function (key) {
var value = attrs[key];
if (value === null || value === undefined || value === false) return;
if (key === 'class') node.className = value;
else if (key === 'text') node.textContent = value;
else if (key === 'html') node.innerHTML = value;
else if (key.slice(0, 2) === 'on' && typeof value === 'function') node.addEventListener(key.slice(2), value);
else if (key === 'checked' || key === 'selected' || key === 'disabled' || key === 'hidden') node[key] = !!value;
else node.setAttribute(key, value);
});
}
for (var i = 2; i < arguments.length; i++) {
var child = arguments[i];
if (child === null || child === undefined || child === false) continue;
if (Array.isArray(child)) child.forEach(function (c) { if (c !== null && c !== undefined && c !== false) node.appendChild(c); });
else if (typeof child === 'string') node.appendChild(document.createTextNode(child));
else node.appendChild(child);
}
return node;
}

function sourceRows() {
return state.status === 'trades' ? DATA.live : DATA.rows;
}

function matches(row) {
var q = state.q.trim().toLowerCase();
if (state.category !== 'all' && (row.category || 'Uncategorised') !== state.category) return false;
if (state.chain !== 'all' && (row.chains || []).indexOf(state.chain) < 0) return false;
if (state.status === 'no-token' && state.confidence !== 'all') {
if (!row.valuation || row.valuation.confidence.label !== state.confidence) return false;
}
if (state.status === 'no-token' && state.watchlist && !row.watchlist) return false;
if (!q) return true;
var hay = [row.name, row.slug, row.category || '', (row.chains || []).join(' '), row.symbol || '', row.gecko_id || ''].join(' ').toLowerCase();
return hay.indexOf(q) >= 0;
}

function compare(a, b) {
var key = state.sort;
var av;
var bv;
if (key === 'rank') { av = a.rank === undefined ? 1e9 : a.rank; bv = b.rank === undefined ? 1e9 : b.rank; }
else if (key === 'name') { av = a.name.toLowerCase(); bv = b.name.toLowerCase(); }
else if (key === 'category') { av = (a.category || '').toLowerCase(); bv = (b.category || '').toLowerCase(); }
else if (key === 'tvl') { av = a.tvl_usd; bv = b.tvl_usd; }
else if (key === 'growth') { av = a.change_7d === null ? -Infinity : a.change_7d; bv = b.change_7d === null ? -Infinity : b.change_7d; }
else if (key === 'age') { av = a.age_days === null ? Infinity : a.age_days; bv = b.age_days === null ? Infinity : b.age_days; }
else if (key === 'confidence') { av = a.valuation ? a.valuation.confidence.score : -1; bv = b.valuation ? b.valuation.confidence.score : -1; }
else if (key === 'mcap') { av = a.mcap_usd === null ? -Infinity : a.mcap_usd; bv = b.mcap_usd === null ? -Infinity : b.mcap_usd; }
else { av = a.implied_value_usd; bv = b.implied_value_usd; }
if (av < bv) return -state.dir;
if (av > bv) return state.dir;
return a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0;
}

function filtered() {
return sourceRows().filter(matches).sort(compare);
}

function writeHash() {
var params = new URLSearchParams();
if (state.q) params.set('q', state.q);
if (state.category !== 'all') params.set('category', state.category);
if (state.chain !== 'all') params.set('chain', state.chain);
if (state.confidence !== 'all') params.set('confidence', state.confidence);
if (state.status !== 'no-token') params.set('status', state.status);
if (state.watchlist) params.set('watchlist', '1');
if (state.sort !== 'rank') params.set('sort', state.sort);
if (state.selected) params.set('p', state.selected);
var next = params.toString();
window.history.replaceState(null, '', next ? '#' + next : window.location.pathname + window.location.search);
}

function readHash() {
var params = new URLSearchParams(window.location.hash.replace(/^#/, ''));
state.q = params.get('q') || '';
state.category = params.get('category') || 'all';
state.chain = params.get('chain') || 'all';
state.confidence = params.get('confidence') || 'all';
state.status = params.get('status') === 'trades' ? 'trades' : 'no-token';
state.watchlist = params.get('watchlist') === '1';
state.sort = params.get('sort') || (state.status === 'trades' ? 'mcap' : 'rank');
state.dir = state.status === 'trades' ? -1 : 1;
state.selected = params.get('p') || null;
}

function renderMasthead() {
var meta = document.getElementById('masthead-meta');
meta.textContent = '';
[
['Snapshot', DATA.meta.as_of],
['Source', 'DefiLlama protocol index'],
['Model', DATA.meta.model.version],
['Watchlist', DATA.meta.watchlist_size + ' protocols']
].forEach(function (pair) {
meta.appendChild(el('span', null, el('b', { text: pair[0] + ': ' }), pair[1]));
});
}

function renderHero() {
document.getElementById('hero-lede').textContent =
'A sealed ' + DATA.meta.as_of + ' snapshot of ' + fmtInt(DATA.meta.board_size + DATA.meta.live_size + (DATA.meta.no_token_size - DATA.meta.board_size)) +
' protocol records. FIELDNOTE ranks ' + fmtInt(DATA.meta.board_size) + ' that record no token, using live category peers for a conservative implied launch value, then shows exactly how to farm each one.';
var facts = document.getElementById('hero-facts');
facts.textContent = '';
[
[DATA.meta.watchlist_size, 'watchlist protocols', 'all covered'],
[DATA.meta.board_size, 'ranked no-token rows', DATA.meta.early_size + ' below the floor'],
[DATA.meta.no_token_size, 'records with no token', 'not a claim none exists'],
[DATA.meta.live_size, 'token-bearing records', 'kept as peer comps']
].forEach(function (fact) {
facts.appendChild(el('div', { class: 'fact' },
el('span', { text: fact[1] }),
el('b', { text: fmtInt(fact[0]) }),
el('small', { text: fact[2] })
));
});
document.getElementById('board-note').textContent =
'Ranked by the base implied value, then TVL. Each row also carries a low–high band from the peer pool\'s mcap/TVL quartiles: a peer-disagreement walk, not a market prediction.';
}

function fillSelect(id, values, current, label) {
var select = document.getElementById(id);
while (select.options.length > 1) select.remove(1);
values.forEach(function (value) {
select.appendChild(el('option', { value: value, text: value, selected: value === current }));
});
select.value = current;
select.setAttribute('aria-label', label);
}

function renderControls() {
var categories = {};
var chains = {};
DATA.rows.concat(DATA.live).forEach(function (row) {
categories[row.category || 'Uncategorised'] = true;
(row.chains || []).forEach(function (chain) { chains[chain] = true; });
});
var catList = Object.keys(categories).sort();
var chainList = Object.keys(chains).sort();
if (catList.indexOf(state.category) < 0) state.category = 'all';
if (chainList.indexOf(state.chain) < 0) state.chain = 'all';
fillSelect('category', catList, state.category, 'Filter by category');
fillSelect('chain', chainList, state.chain, 'Filter by chain');
document.getElementById('search').value = state.q;
document.getElementById('confidence').value = state.status === 'no-token' ? state.confidence : 'all';
document.getElementById('confidence').disabled = state.status === 'trades';
document.getElementById('watchlist-only').checked = state.watchlist;
document.getElementById('watchlist-only').disabled = state.status === 'trades';
var tabs = document.querySelectorAll('#status-tabs button');
Array.prototype.forEach.call(tabs, function (tab) {
var active = tab.getAttribute('data-status') === state.status;
tab.setAttribute('aria-pressed', active ? 'true' : 'false');
});
}

function renderFilterLine() {
var line = document.getElementById('filter-line');
line.textContent = '';
var chips = [];
if (state.q) chips.push(['search', 'Search: ' + state.q, function () { state.q = ''; }]);
if (state.category !== 'all') chips.push(['category', 'Category: ' + state.category, function () { state.category = 'all'; }]);
if (state.chain !== 'all') chips.push(['chain', 'Chain: ' + state.chain, function () { state.chain = 'all'; }]);
if (state.confidence !== 'all' && state.status === 'no-token') chips.push(['confidence', 'Confidence: ' + state.confidence, function () { state.confidence = 'all'; }]);
if (state.watchlist && state.status === 'no-token') chips.push(['watchlist', 'Watchlist only', function () { state.watchlist = false; }]);
if (chips.length === 0) {
line.appendChild(el('span', { text: 'Showing every ' + (state.status === 'trades' ? 'token-bearing record' : 'ranked no-token record') + '.' }));
return;
}
line.appendChild(el('span', { text: 'Filters:' }));
chips.forEach(function (chip) {
var remove = el('button', { type: 'button', 'aria-label': 'Remove ' + chip[0] + ' filter', text: '×' });
remove.addEventListener('click', function () {
chip[2]();
state.page = 1;
writeHash();
render();
});
line.appendChild(el('span', { class: 'chip' }, chip[1], remove));
});
}

function renderCharts() {
var ladder = document.getElementById('value-ladder');
ladder.textContent = '';
var top = DATA.rows.slice(0, 6);
var max = DATA.stats.top_implied || 1;
top.forEach(function (row) {
ladder.appendChild(el('div', { class: 'ladder-row', 'aria-label': row.name + ' estimated ' + fmtFullUsd(row.implied_value_usd) },
el('span', { class: 'n', text: String(row.rank).padStart(2, '0') }),
el('span', { class: 'label' }, el('b', { text: row.name })),
el('span', { class: 'amt', text: fmtUsd(row.implied_value_usd) }),
el('span', { class: 'track', 'aria-hidden': 'true' }, el('i', { style: 'width:' + Math.max(2, (row.implied_value_usd / max) * 100).toFixed(1) + '%' }))
));
});

var cat = document.getElementById('category-chart');
cat.textContent = '';
var cats = DATA.stats.watchlist_by_category.slice(0, 8);
var catMax = cats.length > 0 ? cats[0].count : 1;
document.getElementById('coverage-total').textContent = DATA.meta.watchlist_size + ' total';
cats.forEach(function (entry) {
cat.appendChild(el('div', { class: 'bar-row', 'aria-label': entry.name + ': ' + entry.count + ' watchlist protocols' },
el('div', { class: 'bar-label' },
el('span', { text: entry.name }),
el('span', { class: 'bar-track', 'aria-hidden': 'true' }, el('i', { style: 'width:' + Math.max(3, (entry.count / catMax) * 100).toFixed(1) + '%' }))
),
el('span', { class: 'bar-count', text: String(entry.count) })
));
});

var conf = document.getElementById('confidence-chart');
conf.textContent = '';
var total = DATA.stats.confidence.High + DATA.stats.confidence.Medium + DATA.stats.confidence.Low;
['High', 'Medium', 'Low'].forEach(function (label) {
var count = DATA.stats.confidence[label];
if (count === 0) return;
conf.appendChild(el('div', {
class: label.toLowerCase(),
style: 'width:' + Math.max(3, (count / total) * 100).toFixed(1) + '%',
'aria-label': label + ' confidence: ' + count + ' rows',
text: count >= 8 ? String(count) : ''
}));
});
var key = el('div', { class: 'confidence-key' });
['High', 'Medium', 'Low'].forEach(function (label) {
var color = label === 'High' ? 'var(--green)' : label === 'Medium' ? 'var(--blue)' : 'var(--line-strong)';
key.appendChild(el('span', null, el('i', { style: 'background:' + color }), label + ' ' + DATA.stats.confidence[label]));
});
var chartBlock = document.getElementById('confidence-chart');
if (!document.getElementById('confidence-key')) {
chartBlock.parentNode.appendChild(key);
key.id = 'confidence-key';
} else {
var old = document.getElementById('confidence-key');
old.parentNode.replaceChild(key, old);
key.id = 'confidence-key';
}

document.getElementById('record-note').textContent =
DATA.meta.board_size + ' no-token records are ranked. ' + DATA.meta.watchlist_size +
' clear the watchlist floor. ' + DATA.meta.live_size + ' records already carry a token and are kept out of the ranking, where their market caps become the peer comps.';
document.getElementById('footer-meta').textContent =
'Snapshot ' + DATA.meta.as_of + ' / model ' + DATA.meta.model.version + ' / ' + DATA.meta.board_size + ' ranked rows / offline static page';
}

function sortButton(key, label, extraClass) {
var th = el('th', { scope: 'col', class: extraClass || '' });
var active = state.sort === key;
th.setAttribute('aria-sort', active ? (state.dir < 0 ? 'descending' : 'ascending') : 'none');
var button = el('button', { type: 'button' },
label,
active ? el('span', { 'aria-hidden': 'true', text: state.dir < 0 ? '↓' : '↑' }) : null
);
button.addEventListener('click', function () {
if (state.sort === key) state.dir = -state.dir;
else { state.sort = key; state.dir = key === 'rank' || key === 'name' || key === 'category' ? 1 : -1; }
state.page = 1;
writeHash();
render();
});
th.appendChild(button);
return th;
}

function renderHead() {
var head = document.getElementById('table-head');
head.textContent = '';
var row = el('tr');
if (state.status === 'trades') {
row.appendChild(sortButton('mcap', 'Rank', 'num'));
row.appendChild(sortButton('name', 'Protocol'));
row.appendChild(sortButton('category', 'Category', 'col-cat'));
row.appendChild(el('th', { scope: 'col', class: 'col-chains', text: 'Chains' }));
row.appendChild(sortButton('tvl', 'TVL', 'num'));
row.appendChild(sortButton('growth', '7d', 'num col-delta'));
row.appendChild(sortButton('age', 'Age', 'num col-age'));
row.appendChild(el('th', { scope: 'col', class: 'num', text: 'mcap/TVL' }));
row.appendChild(sortButton('mcap', 'Market cap', 'num'));
} else {
row.appendChild(sortButton('rank', 'Rank', 'num'));
row.appendChild(sortButton('name', 'Protocol'));
row.appendChild(sortButton('category', 'Category', 'col-cat'));
row.appendChild(el('th', { scope: 'col', class: 'col-chains', text: 'Chains' }));
row.appendChild(sortButton('tvl', 'TVL', 'num'));
row.appendChild(sortButton('growth', '7d', 'num col-delta'));
row.appendChild(sortButton('age', 'Age', 'num col-age'));
row.appendChild(sortButton('confidence', 'Confidence'));
row.appendChild(sortButton('implied', 'Est. value', 'num'));
}
head.appendChild(row);
document.getElementById('table-caption').textContent = state.status === 'trades'
? 'Token-bearing protocols by market cap, kept apart from the pre-token board'
: 'Protocols with no token in DefiLlama\'s record, ranked by conservative implied launch value';
}

function openButton(row) {
var button = el('button', { type: 'button', text: row.name, 'aria-haspopup': 'dialog' });
button.addEventListener('click', function (event) {
event.stopPropagation();
openDrawer(row.slug);
});
return button;
}

function confidenceBadge(row) {
if (!row.valuation) return el('span', { class: 'badge low', text: 'n/a' });
var label = row.valuation.confidence.label;
return el('span', { class: 'badge ' + label.toLowerCase(), title: row.valuation.confidence.note, text: label });
}

function valueCell(row) {
if (state.status === 'trades') {
var maxMcap = DATA.live.length > 0 && DATA.live[0].mcap_usd ? DATA.live[0].mcap_usd : 1;
var mcap = row.mcap_usd || 0;
return el('td', { class: 'num' },
el('div', { class: 'value' },
el('b', { text: fmtUsd(row.mcap_usd) }),
el('span', { class: 'value-bar', 'aria-hidden': 'true' }, el('i', { style: 'width:' + Math.max(2, (mcap / maxMcap) * 100).toFixed(1) + '%' })),
el('small', { text: 'trades now' })
)
);
}
var top = DATA.stats.top_implied || 1;
return el('td', { class: 'num' },
el('div', { class: 'value' },
el('b', { text: fmtUsd(row.implied_value_usd) }),
el('span', { class: 'value-band', text: fmtUsd(row.implied_low_usd) + '–' + fmtUsd(row.implied_high_usd) + ' band' }),
el('span', { class: 'value-bar', 'aria-hidden': 'true' }, el('i', { style: 'width:' + Math.max(2, (row.implied_value_usd / top) * 100).toFixed(1) + '%' })),
el('small', { text: row.valuation.confidence.label.toLowerCase() + ' confidence' })
)
);
}

function renderRows(list) {
var body = document.getElementById('table-body');
body.textContent = '';
var start = (state.page - 1) * PAGE_SIZE;
var pageRows = list.slice(start, start + PAGE_SIZE);
pageRows.forEach(function (row, index) {
var tr = el('tr', { 'data-slug': row.slug });
if (state.selected === row.slug) tr.className = 'is-open';
tr.addEventListener('click', function () { openDrawer(row.slug); });

if (state.status === 'trades') {
tr.appendChild(el('td', { class: 'num' }, el('span', { class: 'rank' }, el('strong', { text: String(start + index + 1) }))));
} else {
tr.appendChild(el('td', { class: 'num' }, el('span', { class: 'rank' }, el('strong', { text: String(row.rank) }))));
}

var badges = el('span', { class: 'badges' });
if (row.watchlist) badges.appendChild(el('span', { class: 'badge watch', title: 'On the snapshot watchlist', text: 'WL' }));
badges.appendChild(el('span', { class: 'badge ' + (state.status === 'trades' ? 'live' : 'low'), text: state.status === 'trades' ? 'Trades' : 'No token recorded' }));
tr.appendChild(el('td', null,
el('div', { class: 'proto' }, openButton(row), el('span', { text: row.slug }), badges)
));

tr.appendChild(el('td', { class: 'cat col-cat', text: row.category || 'Uncategorised' }));
tr.appendChild(el('td', { class: 'chains col-chains', text: (row.chains || []).join(', ') || 'n/a' }));
tr.appendChild(el('td', { class: 'num', text: fmtUsd(row.tvl_usd) }));
var delta = row.change_7d;
tr.appendChild(el('td', { class: 'num col-delta' },
el('span', { class: 'delta ' + (delta === null ? 'none' : delta >= 0 ? 'pos' : 'neg'), text: fmtPct(delta) })
));
tr.appendChild(el('td', { class: 'num col-age', text: fmtAge(row.age_days) }));
if (state.status === 'trades') {
tr.appendChild(el('td', { class: 'num', text: fmtRatio(row.mcap_tvl) }));
} else {
tr.appendChild(el('td', null, confidenceBadge(row)));
}
tr.appendChild(valueCell(row));
body.appendChild(tr);
});
}

function renderPager(total) {
var pager = document.getElementById('pager');
var pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
if (state.page > pages) state.page = pages;
pager.hidden = pages <= 1;
document.getElementById('page-label').textContent = 'Page ' + state.page + ' of ' + pages + ' / ' + fmtInt(total) + ' rows';
document.getElementById('prev-page').disabled = state.page <= 1;
document.getElementById('next-page').disabled = state.page >= pages;
}

function renderTable() {
var list = filtered();
var total = list.length;
var pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
if (state.page > pages) state.page = pages;
document.getElementById('result-count').textContent = fmtInt(total) + (state.status === 'trades' ? ' token-bearing records' : ' ranked no-token records');
var empty = document.getElementById('empty');
var tableWrap = document.querySelector('.table-wrap');
empty.hidden = total !== 0;
tableWrap.hidden = total === 0;
if (total > 0) renderRows(list);
else document.getElementById('table-body').textContent = '';
renderPager(total);
}

var lastFocus = null;
function closeDrawer() {
var drawer = document.getElementById('drawer');
var backdrop = document.getElementById('drawer-backdrop');
if (drawer.hidden) return;
drawer.hidden = true;
backdrop.hidden = true;
document.body.style.overflow = '';
state.selected = null;
writeHash();
if (lastFocus && lastFocus.focus) lastFocus.focus();
}

function drawerBreakdown(row) {
var v = row.valuation;
return el('table', { class: 'breakdown' },
el('tbody', null,
el('tr', null, el('th', { scope: 'row', text: 'TVL in snapshot' }), el('td', { text: fmtFullUsd(v.tvl_usd) })),
el('tr', null, el('th', { scope: 'row', text: 'Peer ratio p25 (' + v.comp_sample + ' ' + v.comp_source + ')' }), el('td', { text: fmtRatio(v.peer_p25) })),
el('tr', null, el('th', { scope: 'row', text: 'Peer ratio p50 / median' }), el('td', { text: fmtRatio(v.peer_p50) })),
el('tr', null, el('th', { scope: 'row', text: 'Peer ratio p75' }), el('td', { text: fmtRatio(v.peer_p75) })),
el('tr', null, el('th', { scope: 'row', text: 'Conservative haircut' }), el('td', { text: '× ' + v.comp_haircut.toFixed(2) })),
el('tr', null, el('th', { scope: 'row', text: 'Comp used at base' }), el('td', { text: fmtRatio(v.comp_used) })),
el('tr', null, el('th', { scope: 'row', text: '7d growth multiplier' }), el('td', { text: '× ' + v.growth_multiplier.toFixed(2) + ' (' + fmtPct(v.growth_pct) + ')' })),
el('tr', null, el('th', { scope: 'row', text: 'Maturity multiplier' }), el('td', { text: '× ' + v.maturity_multiplier.toFixed(2) + ' (' + fmtAge(row.age_days) + ')' })),
el('tr', null, el('th', { scope: 'row', text: 'Confidence factor' }), el('td', { text: '× ' + v.confidence_factor.toFixed(2) + ' (' + v.confidence.label + ')' })),
el('tr', { class: 'band-row' }, el('th', { scope: 'row', text: 'Implied low (p25)' }), el('td', { text: fmtFullUsd(v.implied_low_usd) })),
el('tr', { class: 'band-row' }, el('th', { scope: 'row', text: 'Implied base (rank key)' }), el('td', { text: fmtFullUsd(v.implied_base_usd) })),
el('tr', { class: 'band-row' }, el('th', { scope: 'row', text: 'Implied high (p75)' }), el('td', { text: fmtFullUsd(v.implied_high_usd) }))
)
);
}

function drawerPeers(row) {
if (!row.peer_comps || row.peer_comps.length === 0) return el('p', { class: 'side-note', text: 'No live peer with a market cap was available for this category.' });
return el('table', { class: 'peer-table' },
el('thead', null, el('tr', null,
el('th', { scope: 'col', text: 'Peer' }), el('th', { scope: 'col', class: 'num', text: 'TVL' }),
el('th', { scope: 'col', class: 'num', text: 'Mcap' }), el('th', { scope: 'col', class: 'num', text: 'Mcap/TVL' })
)),
el('tbody', null, row.peer_comps.map(function (peer) {
return el('tr', null,
el('td', { text: peer.name }),
el('td', { class: 'num', text: fmtUsd(peer.tvl_usd) }),
el('td', { class: 'num', text: fmtUsd(peer.mcap_usd) }),
el('td', { class: 'num', text: fmtRatio(peer.ratio) })
);
}))
);
}

function drawerRisk(row) {
return el('ul', { class: 'risk-list' }, row.risk.flags.map(function (flag) {
return el('li', { class: 'risk-item' },
el('span', { class: 'level ' + flag.level, text: flag.level }),
el('div', null, el('b', { text: flag.label }), el('p', { text: flag.detail }))
);
}));
}

function drawerFarm(row) {
var plan = row.farm_plan || [];
if (!plan.length) {
return el('ol', { class: 'farm-list' }, row.farm_steps.map(function (text) { return el('li', { text: text }); }));
}
var low = 0;
var high = 0;
plan.forEach(function (item) { low += item.cost_low_usd; high += item.cost_high_usd; });
var table = el('table', { class: 'farm-table' },
el('thead', null, el('tr', null,
el('th', { scope: 'col', text: '#' }),
el('th', { scope: 'col', text: 'Action' }),
el('th', { scope: 'col', class: 'num', text: 'Cost (USD)' }),
el('th', { scope: 'col', class: 'num', text: 'Time' })
)),
el('tbody', null, plan.map(function (item) {
return el('tr', null,
el('td', { class: 'farm-step-num', text: String(item.step) }),
el('td', { text: item.action }),
el('td', { class: 'num', text: item.cost }),
el('td', { class: 'num', text: item.duration })
);
})),
el('tfoot', null, el('tr', null,
el('td', { colspan: '2', text: 'Total for this plan' }),
el('td', { class: 'num', text: fmtUsd(low) + '–' + fmtUsd(high) }),
el('td', { class: 'num', text: row.farm_time_days + ' days' })
))
);
return el('div', { class: 'farm-wrap' },
el('div', { class: 'farm-totals' },
el('span', null, el('b', { text: fmtFullUsd(row.farm_budget_usd) }), ' capital to deploy'),
el('span', null, el('b', { text: String(row.farm_time_days) + ' days' }), ' calendar time incl. weekly cadence'),
el('span', null, el('b', { text: fmtUsd(low) + '–' + fmtUsd(high) }), ' est. gas and fees')
),
table
);
}

function drawerRecord(row) {
return el('dl', { class: 'record-grid' },
el('dt', { text: 'Slug' }), el('dd', { text: row.slug }),
el('dt', { text: 'Category' }), el('dd', { text: row.category || 'not recorded' }),
el('dt', { text: 'Chains' }), el('dd', { text: (row.chains || []).join(', ') || 'not recorded' }),
el('dt', { text: 'TVL' }), el('dd', { text: fmtFullUsd(row.tvl_usd) }),
el('dt', { text: '7-day change' }), el('dd', { text: fmtPct(row.change_7d) }),
el('dt', { text: 'Market cap' }), el('dd', { text: row.mcap_usd === null ? 'null in record' : fmtFullUsd(row.mcap_usd) }),
el('dt', { text: 'Listed at' }), el('dd', { text: row.listed_at || 'not recorded' }),
el('dt', { text: 'Gecko id' }), el('dd', { text: row.gecko_id || 'null in record' }),
el('dt', { text: 'Symbol' }), el('dd', { text: row.symbol || 'null in record' })
);
}

function renderDrawer(row) {
var body = document.getElementById('drawer-body');
body.textContent = '';
var eyebrow = document.getElementById('drawer-eyebrow');
if (state.status === 'trades') {
eyebrow.textContent = 'Token-bearing record / set aside from the board';
body.appendChild(el('h2', { id: 'drawer-title', text: row.name }));
body.appendChild(el('div', { class: 'drawer-sub' },
el('span', { text: row.category || 'Uncategorised' }),
el('span', { text: (row.chains || []).join(', ') || 'chain not recorded' }),
el('span', { class: 'badge live', text: 'Token trades' })
));
body.appendChild(el('div', { class: 'drawer-value' },
el('div', null, el('div', { class: 'caption', text: 'Market cap in the snapshot' }), el('div', { class: 'big', text: fmtFullUsd(row.mcap_usd) })),
el('div', null, el('div', { class: 'caption', text: 'Mcap / TVL' }), el('div', { class: 'big', text: fmtRatio(row.mcap_tvl) }))
));
body.appendChild(el('section', { class: 'drawer-section' },
el('h3', { text: 'Why it is here' }),
el('p', { class: 'side-note', text: 'DefiLlama records a token for this protocol, so it is not a pre-token candidate. Its market cap and TVL are used as live peer comps for the no-token protocols in the same category.' })
));
body.appendChild(el('section', { class: 'drawer-section' }, el('h3', { text: 'Snapshot record' }), drawerRecord(row)));
body.appendChild(el('div', { class: 'drawer-note', text: 'A token in the record is not an endorsement. This note shows the sealed snapshot fields only; it does not value the token or recommend trading it.' }));
return;
}
eyebrow.textContent = 'Protocol note / rank ' + row.rank + ' of ' + DATA.meta.board_size;
body.appendChild(el('h2', { id: 'drawer-title', text: row.name }));
body.appendChild(el('div', { class: 'drawer-sub' },
el('span', { text: row.category || 'Uncategorised' }),
el('span', { text: (row.chains || []).join(', ') || 'chain not recorded' }),
row.watchlist ? el('span', { class: 'badge watch', text: 'On the snapshot watchlist' }) : null,
el('span', { class: 'badge low', text: 'No token in record' })
));
body.appendChild(el('div', { class: 'drawer-value' },
el('div', null,
el('div', { class: 'caption', text: 'Conservative implied launch value' }),
el('div', { class: 'big', text: fmtFullUsd(row.implied_value_usd) }),
el('div', { class: 'caption', text: row.valuation.confidence.label + ' confidence / risk score ' + row.risk.score + ' / 100' })
),
confidenceBadge(row)
));
body.appendChild(el('section', { class: 'drawer-section' },
el('h3', { text: 'Valuation walk' }),
drawerBreakdown(row),
el('p', { class: 'drawer-note', text: row.valuation.band_note }),
el('p', { class: 'drawer-note', text: row.valuation.formula + '. The band is a peer-ratio quartile walk, not a market prediction or a promise that a token launches.' })
));
body.appendChild(el('section', { class: 'drawer-section' },
el('h3', { text: 'Risk register' }),
drawerRisk(row)
));
body.appendChild(el('section', { class: 'drawer-section' },
el('h3', { text: 'Costed farm timeline' }),
el('p', { class: 'side-note', text: 'Six steps derived from this protocol\'s category, chains, TVL and age. Each names a USD cost range and a duration; the totals below add them up. No step requires paying to claim.' }),
drawerFarm(row)
));
body.appendChild(el('section', { class: 'drawer-section' },
el('h3', { text: 'Live peer comps' }),
el('p', { class: 'side-note', text: 'The closest live-token protocols by TVL from the same peer pool used for the p25/p50/p75 ratios above.' }),
drawerPeers(row)
));
body.appendChild(el('section', { class: 'drawer-section' },
el('h3', { text: 'Snapshot record' }),
drawerRecord(row)
));
body.appendChild(el('div', { class: 'drawer-note', text: 'gecko_id, symbol and mcap_usd are null in DefiLlama\'s sealed record. That means no token is recorded, not that the protocol has none. The snapshot is static; verify contracts and eligibility before committing capital.' }));
}

function openDrawer(slug) {
var row = null;
for (var i = 0; i < DATA.rows.length; i++) if (DATA.rows[i].slug === slug) { row = DATA.rows[i]; break; }
if (!row) for (var j = 0; j < DATA.live.length; j++) if (DATA.live[j].slug === slug) { row = DATA.live[j]; break; }
if (!row) return;
state.selected = slug;
if (document.activeElement && document.activeElement.focus) lastFocus = document.activeElement;
renderDrawer(row);
document.getElementById('drawer').hidden = false;
document.getElementById('drawer-backdrop').hidden = false;
document.body.style.overflow = 'hidden';
writeHash();
document.getElementById('drawer-close').focus();
}

function trapFocus(event) {
if (event.key === 'Escape') { closeDrawer(); return; }
if (event.key !== 'Tab') return;
var drawer = document.getElementById('drawer');
if (drawer.hidden) return;
var focusable = drawer.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
if (focusable.length === 0) return;
var first = focusable[0];
var last = focusable[focusable.length - 1];
if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
}

function render() {
if (state.status === 'trades' && (state.sort === 'rank' || state.sort === 'implied' || state.sort === 'confidence')) {
state.sort = 'mcap';
state.dir = -1;
}
if (state.status === 'no-token' && state.sort === 'mcap') {
state.sort = 'rank';
state.dir = 1;
}
renderControls();
renderFilterLine();
renderHead();
renderTable();
if (!state.selected) {
document.getElementById('drawer').hidden = true;
document.getElementById('drawer-backdrop').hidden = true;
document.body.style.overflow = '';
}
if (state.selected) {
var row = DATA.rows.filter(function (r) { return r.slug === state.selected; })[0] ||
DATA.live.filter(function (r) { return r.slug === state.selected; })[0];
if (row) {
renderDrawer(row);
document.getElementById('drawer').hidden = false;
document.getElementById('drawer-backdrop').hidden = false;
document.body.style.overflow = 'hidden';
}
}
}

function bind() {
var search = document.getElementById('search');
search.addEventListener('input', function () { state.q = search.value; state.page = 1; writeHash(); render(); });
document.getElementById('category').addEventListener('change', function (event) { state.category = event.target.value; state.page = 1; writeHash(); render(); });
document.getElementById('chain').addEventListener('change', function (event) { state.chain = event.target.value; state.page = 1; writeHash(); render(); });
document.getElementById('confidence').addEventListener('change', function (event) { state.confidence = event.target.value; state.page = 1; writeHash(); render(); });
document.getElementById('watchlist-only').addEventListener('change', function (event) { state.watchlist = event.target.checked; state.page = 1; writeHash(); render(); });
Array.prototype.forEach.call(document.querySelectorAll('#status-tabs button'), function (tab) {
tab.addEventListener('click', function () {
state.status = tab.getAttribute('data-status');
state.page = 1;
state.watchlist = false;
state.confidence = 'all';
state.sort = state.status === 'trades' ? 'mcap' : 'rank';
state.dir = state.status === 'trades' ? -1 : 1;
state.selected = null;
writeHash();
render();
});
});
document.getElementById('reset').addEventListener('click', resetFilters);
document.getElementById('empty-reset').addEventListener('click', resetFilters);
document.getElementById('prev-page').addEventListener('click', function () { if (state.page > 1) { state.page -= 1; renderTable(); window.scrollTo({ top: root.offsetTop, behavior: 'smooth' }); } });
document.getElementById('next-page').addEventListener('click', function () { state.page += 1; renderTable(); window.scrollTo({ top: root.offsetTop, behavior: 'smooth' }); });
document.getElementById('drawer-close').addEventListener('click', closeDrawer);
document.getElementById('drawer-backdrop').addEventListener('click', closeDrawer);
document.addEventListener('keydown', trapFocus);
window.addEventListener('hashchange', function () { readHash(); render(); });
}

function resetFilters() {
state.q = '';
state.category = 'all';
state.chain = 'all';
state.confidence = 'all';
state.watchlist = false;
state.page = 1;
writeHash();
render();
}

readHash();
renderMasthead();
renderHero();
renderCharts();
bind();
render();
})();
