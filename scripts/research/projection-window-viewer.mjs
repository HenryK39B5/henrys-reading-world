const $ = (id) => document.getElementById(id);
const response = await fetch('/viewer-data.json', { cache: 'no-store' });
if (!response.ok) { $('status').textContent = '研究数据未生成'; throw new Error('projection data unavailable'); }
const data = await response.json();
document.querySelector('.controls').addEventListener('submit', (event) => event.preventDefault());
const points = data.points;
const byId = new Map(points.map((p, index) => [p.id, { ...p, index }]));
const highById = new Map(data.queries.map((q) => [q.id, q.referenceNearest30]));
const crossBookById = new Map((data.crossBookReferences ?? []).map((q) => [q.id, q.neighborIds]));
const topicNames = new Map(data.topics.map((t) => [t.id, t.title]));
const canvas = $('plot');
const ctx = canvas.getContext('2d');
const state = { mode: 'published', topic: 'tag-026', alpha: 1, theta: 0, selected: data.cases[0].id, tab: 'high', zoom: 1, panX: 0, panY: 0 };
let coordinates = [];
let screenPositions = [];
let lowIds = [];
let viewId = 'published';
let bounds;
let drawCount = 0;
let drag;

$('corpus').textContent = `${points.length.toLocaleString('en-US')} 条 / ${new Set(points.map((p) => p.bookId)).size} 本`;
for (const topic of data.topics) {
    const option = document.createElement('option'); option.value = topic.id; option.textContent = `${topic.title} · ${topic.count}`; $('topic').append(option);
}
$('topic').value = state.topic;
const orderedQueries = [...new Set([...data.cases.map((c) => c.id), ...data.queries.map((q) => q.id)])];
for (const id of orderedQueries) {
    const p = byId.get(id);
    const c = data.cases.find((entry) => entry.id === id);
    const option = document.createElement('option'); option.value = id;
    option.textContent = c ? `${topicNames.get(c.tagId)} · ${c.method === 'localDensity' ? '密集候选' : '跨书候选'} · ${id}` : `${id} · ${p.source}`;
    $('query').append(option);
}
$('query').value = state.selected;

function viewTitle(view) { return view.heldoutBookId === undefined ? view.title : view.title.replace(' · 留书 ', ' · 条件轴留出 '); }
for (const view of data.views.filter((v) => v.id.startsWith('pca64-umap') || v.id.startsWith('loo-'))) {
    const option = document.createElement('option'); option.value = view.id; option.title = viewTitle(view);
    option.textContent = view.heldoutBookId === undefined ? (view.id.endsWith('raw') ? 'PCA64 UMAP raw' : 'PCA64 UMAP') : `留书 ${topicNames.get(view.topic)} ${view.heldoutBookId}`;
    $('window').append(option);
}
function highNeighbors() { return state.mode.startsWith('loo-') ? crossBookById.get(state.selected) : highById.get(state.selected); }

function updateCoordinates() {
    viewId = state.mode === 'pca' ? `pca-${state.theta}` : state.mode.startsWith('cpca') ? `${state.mode}-${state.topic}-${state.mode === 'cpca1024' ? 1 : state.alpha}` : state.mode;
    if (state.mode === 'pca') {
        const theta = state.theta * Math.PI / 180;
        coordinates = points.map((p) => [Math.cos(theta) * p.pc4[0] + Math.sin(theta) * p.pc4[2], Math.cos(theta) * p.pc4[1] + Math.sin(theta) * p.pc4[3]]);
        const extent = Math.max(...points.map((p) => Math.max(Math.hypot(p.pc4[0], p.pc4[2]), Math.hypot(p.pc4[1], p.pc4[3]))));
        bounds = { x: 0, y: 0, span: extent * 2 };
    } else {
        coordinates = data.views.find((v) => v.id === viewId).coordinates;
        const xs = coordinates.map((p) => p[0]); const ys = coordinates.map((p) => p[1]);
        const minX = Math.min(...xs); const maxX = Math.max(...xs); const minY = Math.min(...ys); const maxY = Math.max(...ys);
        bounds = { x: (minX + maxX) / 2, y: (minY + maxY) / 2, span: Math.max(maxX - minX, maxY - minY, Number.EPSILON) };
    }
    $('window').value = state.mode; $('topic').value = state.topic;
    $('topic').disabled = state.mode.startsWith('loo-');
    $('alpha').disabled = state.mode !== 'cpca'; $('alpha').value = String(state.mode === 'cpca1024' || state.mode.startsWith('loo-') ? 1 : state.alpha);
    $('angle').disabled = state.mode !== 'pca'; $('angle-value').textContent = `${state.theta}°`; $('angle').value = String(state.theta);
    $('view-title').textContent = state.mode === 'pca' ? `全局 PCA · ${state.theta}°` : viewTitle(data.views.find((v) => v.id === viewId));
    const measurement = data.summary.find((s) => s.id === viewId);
    $('metric').textContent = measurement === undefined ? '30 点原空间近邻保留 · 未采样角度' : `${measurement.sampleLabel ?? '108 查询'} · 30 点近邻保留中位值 ${(measurement.recall30 * 100).toFixed(1)}%`;
    updateSelection();
}

function updateSelection() {
    const selected = byId.get(state.selected);
    const position = coordinates[selected.index];
    lowIds = points.map((p, i) => ({ id: p.id, distance: Math.hypot(coordinates[i][0] - position[0], coordinates[i][1] - position[1]) }))
        .filter((entry) => entry.id !== state.selected && (!state.mode.startsWith('loo-') || byId.get(entry.id).bookId !== selected.bookId)).sort((a, b) => a.distance - b.distance || a.id.localeCompare(b.id)).slice(0, 30).map((entry) => entry.id);
    $('selected-id').textContent = selected.id;
    $('source').textContent = `${selected.source} · ${selected.author}`;
    $('text').textContent = selected.text;
    $('tags').replaceChildren();
    for (const tag of selected.tags) {
        const span = document.createElement('span'); span.textContent = data.tagTitles[tag]; $('tags').append(span);
    }
    if (selected.tags.length === 0) $('tags').textContent = '未标注';
    if (![...$('query').options].some((option) => option.value === selected.id)) {
        const option = document.createElement('option'); option.value = selected.id; option.textContent = `${selected.id} · ${selected.source}`; $('query').append(option);
    }
    $('query').value = state.selected;
    const high = highNeighbors();
    $('overlap').textContent = high === undefined ? '原空间 · 未采样' : `30 点交集 ${lowIds.filter((id) => high.includes(id)).length}`;
    updateNeighbors(); draw();
}

function select(id) { state.selected = id; updateSelection(); }
function updateNeighbors() {
    $('high-tab').setAttribute('aria-selected', String(state.tab === 'high'));
    $('low-tab').setAttribute('aria-selected', String(state.tab === 'low'));
    $('high-tab').tabIndex = state.tab === 'high' ? 0 : -1;
    $('low-tab').tabIndex = state.tab === 'low' ? 0 : -1;
    $('neighbors').setAttribute('aria-labelledby', state.tab === 'high' ? 'high-tab' : 'low-tab');
    const list = state.tab === 'high' ? highNeighbors() ?? [] : lowIds;
    $('neighbors').replaceChildren();
    if (list.length === 0) { const li = document.createElement('li'); li.textContent = '未采样'; $('neighbors').append(li); }
    for (const id of list.slice(0, 10)) {
        const p = byId.get(id); const li = document.createElement('li'); const button = document.createElement('button');
        button.type = 'button'; button.className = 'neighbor'; button.setAttribute('aria-label', `${id} ${p.source}`);
        const excerpt = document.createElement('span'); excerpt.className = 'excerpt'; excerpt.textContent = p.text;
        const source = document.createElement('span'); source.className = 'byline'; source.textContent = `${id} · ${p.source}`;
        button.append(excerpt, source); button.addEventListener('click', () => { select(id); $('selected-id').focus(); }); li.append(button); $('neighbors').append(li);
    }
}

function draw() {
    const rect = canvas.getBoundingClientRect();
    const ratio = window.devicePixelRatio || 1;
    const width = Math.round(rect.width * ratio); const height = Math.round(rect.height * ratio);
    if (canvas.width !== width || canvas.height !== height) { canvas.width = width; canvas.height = height; }
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.fillStyle = '#162525'; ctx.fillRect(0, 0, rect.width, rect.height);
    const scale = Math.max(1, Math.min(rect.width, rect.height) - 56) / bounds.span * state.zoom;
    screenPositions = coordinates.map((p) => [rect.width / 2 + (p[0] - bounds.x) * scale + state.panX, rect.height / 2 + (p[1] - bounds.y) * scale + state.panY]);
    const circle = (i, radius, color, filled = true) => {
        const p = screenPositions[i]; ctx.beginPath(); ctx.arc(p[0], p[1], radius, 0, 2 * Math.PI);
        if (filled) { ctx.fillStyle = color; ctx.fill(); } else { ctx.strokeStyle = color; ctx.lineWidth = 1.4; ctx.stroke(); }
    };
    for (let i = 0; i < points.length; i += 1) circle(i, 1.4, 'rgba(190,208,208,0.32)');
    for (let i = 0; i < points.length; i += 1) if (points[i].tags.includes(state.topic)) circle(i, 2.8, '#cf8da7');
    for (const id of lowIds) circle(byId.get(id).index, 4.1, '#f2c47c', false);
    for (const id of highNeighbors() ?? []) circle(byId.get(id).index, 2.6, '#57d4d4');
    const selected = byId.get(state.selected);
    circle(selected.index, 6.5, '#fff', false); circle(selected.index, 3.5, '#e55774');
    const p = screenPositions[selected.index];
    ctx.font = '12px system-ui'; ctx.fillStyle = '#fff';
    ctx.fillText(selected.id, Math.max(8, Math.min(rect.width - 55, p[0] + 10)), Math.max(15, Math.min(rect.height - 30, p[1] - 10)));
    drawCount += 1;
}

function resetCamera() { state.panX = 0; state.panY = 0; state.zoom = 1; }
$('window').addEventListener('change', (event) => { state.mode = event.target.value; if (state.mode.startsWith('loo-')) state.topic = data.views.find((v) => v.id === state.mode).topic; resetCamera(); updateCoordinates(); });
$('topic').addEventListener('change', (event) => { state.topic = event.target.value; resetCamera(); updateCoordinates(); });
$('alpha').addEventListener('change', (event) => { state.alpha = Number(event.target.value); resetCamera(); updateCoordinates(); });
$('angle').addEventListener('input', (event) => { state.theta = Number(event.target.value); resetCamera(); updateCoordinates(); });
$('query').addEventListener('change', (event) => select(event.target.value));
$('original').addEventListener('click', () => { state.mode = 'published'; state.theta = 0; resetCamera(); updateCoordinates(); });
for (const tab of ['high', 'low']) {
    $(`${tab}-tab`).addEventListener('click', () => { state.tab = tab; updateNeighbors(); });
    $(`${tab}-tab`).addEventListener('keydown', (event) => {
        if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) {
            event.preventDefault(); state.tab = event.key === 'Home' ? 'high' : event.key === 'End' ? 'low' : state.tab === 'high' ? 'low' : 'high';
            updateNeighbors(); $(`${state.tab}-tab`).focus();
        }
    });
}
canvas.addEventListener('pointerdown', (event) => { if (event.button !== 0) return; drag = { x: event.clientX, y: event.clientY, panX: state.panX, panY: state.panY, moved: false }; canvas.setPointerCapture(event.pointerId); });
canvas.addEventListener('pointermove', (event) => {
    if (drag === undefined) return;
    if (Math.hypot(event.clientX - drag.x, event.clientY - drag.y) > 4) drag.moved = true;
    if (drag.moved) { state.panX = drag.panX + event.clientX - drag.x; state.panY = drag.panY + event.clientY - drag.y; draw(); }
});
canvas.addEventListener('pointerup', (event) => {
    if (drag !== undefined && !drag.moved) {
        const rect = canvas.getBoundingClientRect();
        const nearest = screenPositions.map((p, i) => ({ i, distance: Math.hypot(p[0] - (event.clientX - rect.left), p[1] - (event.clientY - rect.top)) })).sort((a, b) => a.distance - b.distance)[0];
        if (nearest.distance <= 12) select(points[nearest.i].id);
    }
    drag = undefined;
});
canvas.addEventListener('pointercancel', () => { drag = undefined; });
canvas.addEventListener('wheel', (event) => {
    event.preventDefault();
    const next = Math.min(12, Math.max(0.5, state.zoom * Math.exp(-event.deltaY * 0.002)));
    const ratio = next / state.zoom; const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left - rect.width / 2; const y = event.clientY - rect.top - rect.height / 2;
    state.panX = x - (x - state.panX) * ratio; state.panY = y - (y - state.panY) * ratio; state.zoom = next; draw();
}, { passive: false });
canvas.addEventListener('keydown', (event) => {
    const moves = { ArrowLeft: [-20, 0], ArrowRight: [20, 0], ArrowUp: [0, -20], ArrowDown: [0, 20] };
    if (moves[event.key]) { event.preventDefault(); state.panX += moves[event.key][0]; state.panY += moves[event.key][1]; draw(); }
    if (['+', '-', '='].includes(event.key)) { event.preventDefault(); state.zoom = Math.min(12, Math.max(0.5, state.zoom * (event.key === '-' ? 0.8 : 1.25))); draw(); }
});
updateCoordinates();
new ResizeObserver(draw).observe(canvas);
window.__projectionStudy = {
    get neighbors() { return { high: [...(highNeighbors() ?? [])], low: [...lowIds] }; },
    get state() { return { ...state, viewId, pointCount: points.length, drawCount, selectedScreen: [...screenPositions[byId.get(state.selected).index]], selectedCoordinates: [...coordinates[byId.get(state.selected).index]] }; },
};
