const $ = (id) => document.getElementById(id);
const groups = [
    { title: '近端', start: 1, end: 4 },
    { title: '侧边', start: 5, end: 10 },
    { title: '外缘', start: 11, end: 16 },
];
let data; let trail = []; let mapPointById; let view = 'text';

function current() { return trail.at(-1); }
function passage(id) { const point = data.points[id]; if (!point) throw new Error(`unknown passage ${id}`); return point; }
function options() {
    const id = current(); const seen = new Set(trail); const usedBooks = new Set(trail.map((pointId) => passage(pointId).bookId));
    const all = data.neighbors[id].map((item, index) => ({ ...item, rank: index + 1 })).filter((item) =>
        !seen.has(item.id) && passage(item.id).bookId !== passage(id).bookId);
    return groups.map((group) => {
        const inBand = all.filter((item) => item.rank >= group.start && item.rank <= group.end);
        return { group, candidate: inBand.find((item) => !usedBooks.has(passage(item.id).bookId)) ?? inBand[0] ?? null, count: inBand.length };
    });
}
function element(tag, className, text) {
    const node = document.createElement(tag); if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
}
function drawMap() {
    if (view === 'text' || !data?.publishedMap || !trail.length) return;
    const canvas = $('atlas'); const width = canvas.clientWidth; const height = canvas.clientHeight;
    if (!width || !height) return;
    const ratio = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.round(width * ratio); canvas.height = Math.round(height * ratio);
    const ctx = canvas.getContext('2d'); if (!ctx) return;
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0); ctx.clearRect(0, 0, width, height);
    const size = Math.min(width, height) - 32; const x0 = (width - size) / 2; const y0 = (height - size) / 2;
    const at = (point) => ({ x: x0 + point.x * size / 10_000, y: y0 + point.y * size / 10_000 });
    for (const contour of data.publishedMap.contours) {
        ctx.strokeStyle = contour.level === 160 ? '#80bbb0' : '#598c8f'; ctx.globalAlpha = contour.level === 160 ? .22 : .13;
        ctx.lineWidth = .8; ctx.beginPath();
        for (const segment of contour.segments) {
            const a = at({ x: segment[0], y: segment[1] }); const b = at({ x: segment[2], y: segment[3] });
            ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y);
        }
        ctx.stroke();
    }
    ctx.globalAlpha = .38; ctx.fillStyle = '#89aaa5';
    for (const point of data.publishedMap.points) { const pos = at(point); ctx.fillRect(pos.x, pos.y, 1.3, 1.3); }
    const candidates = trail.length >= 7 ? [] : options().filter((entry) => entry.candidate !== null);
    const from = at(mapPointById.get(current()));
    ctx.setLineDash([3, 5]); ctx.lineWidth = 1.2;
    for (const [index, entry] of candidates.entries()) {
        const to = at(mapPointById.get(entry.candidate.id));
        ctx.strokeStyle = ['#edd294', '#9ad5c6', '#ddaa89'][index] ?? '#9ad5c6'; ctx.globalAlpha = .8;
        ctx.beginPath(); ctx.moveTo(from.x, from.y); ctx.lineTo(to.x, to.y); ctx.stroke();
        ctx.beginPath(); ctx.arc(to.x, to.y, 3.8, 0, Math.PI * 2); ctx.stroke();
    }
    ctx.setLineDash([]); ctx.globalAlpha = .88; ctx.strokeStyle = '#e9cf96'; ctx.lineWidth = 2.2;
    ctx.beginPath(); trail.forEach((id, index) => { const pos = at(mapPointById.get(id)); if (!index) ctx.moveTo(pos.x, pos.y); else ctx.lineTo(pos.x, pos.y); }); ctx.stroke();
    trail.forEach((id, index) => {
        const pos = at(mapPointById.get(id)); const active = index === trail.length - 1;
        ctx.beginPath(); ctx.arc(pos.x, pos.y, active ? 6.4 : 4, 0, Math.PI * 2);
        ctx.fillStyle = active ? '#f4db9e' : '#dbd6bd'; ctx.globalAlpha = 1; ctx.fill();
        ctx.fillStyle = '#f6e9cb'; ctx.font = '11px system-ui'; ctx.fillText(String(index), pos.x + 8, pos.y - 7);
    });
}
function updateMapSummary() {
    if (trail.length < 2) { $('map-summary').textContent = '起点已定位。选择岔路后，实线会记录你真正走过的句子。'; return; }
    const before = trail.at(-2); const now = current(); const a = mapPointById.get(before); const b = mapPointById.get(now);
    const squared = (a.x - b.x) ** 2 + (a.y - b.y) ** 2;
    const rank = 1 + data.publishedMap.points.filter((point) => {
        if (point.highlightId === before) return false;
        const distance = (point.x - a.x) ** 2 + (point.y - a.y) ** 2;
        return distance < squared || (distance === squared && point.highlightId < now);
    }).length;
    const modelRank = data.neighbors[before].findIndex((item) => item.id === now) + 1;
    $('map-summary').textContent = `上一跳：原向量空间第 ${modelRank} 近；发布平面第 ${rank} 近（共 3461 点），跨度约占平面对角线 ${((Math.sqrt(squared) / (10_000 * Math.SQRT2)) * 100).toFixed(1)}%。这些不是同一种距离。`;
}
function setView(next) {
    if (!['text', 'alongside', 'map-first'].includes(next)) throw new Error('unknown reading view');
    const workspace = $('view-content'); const atlas = workspace.querySelector('.atlas-area');
    if (next === 'map-first') workspace.insertBefore(atlas, workspace.firstElementChild);
    else workspace.querySelector('.passage').after(atlas);
    view = next; workspace.dataset.view = view; atlas.hidden = view === 'text';
    if (view !== 'text') requestAnimationFrame(drawMap);
}
function render(focusPassage = false) {
    const id = current(); const point = passage(id);
    $('step-count').textContent = `${trail.length - 1} / 6 次抵达`;
    $('source').textContent = point.bookTitle;
    $('passage-id').textContent = id;
    $('text').textContent = point.text;
    $('back').disabled = trail.length === 1;
    const trailList = $('trail'); trailList.replaceChildren();
    trail.forEach((pointId, index) => {
        const li = element('li'); const button = element('button', '', `${index === 0 ? '起点' : String(index).padStart(2, '0')} · ${passage(pointId).bookTitle}`);
        button.type = 'button'; button.setAttribute('aria-label', `回到第${index}站：${passage(pointId).bookTitle}`);
        if (index === trail.length - 1) button.setAttribute('aria-current', 'step');
        button.addEventListener('click', () => { trail = trail.slice(0, index + 1); render(true); });
        li.append(button); trailList.append(li);
    });
    const candidates = options(); const finished = trail.length >= 7;
    const available = finished ? 0 : candidates.filter((entry) => entry.candidate !== null).length;
    $('available').textContent = `${available} 条可见岔路 · 模型排名非主题判断`;
    const list = $('options'); list.replaceChildren();
    for (const entry of candidates) {
        const { group, candidate, count } = entry;
        if (candidate === null || finished) {
            const aside = element('div', 'choice unavailable');
            aside.append(element('span', 'label', group.title), element('span', 'rank', finished ? '本轮已走满6步，可返回前一站' : '这一区间没有合格的跨书未见划线'));
            list.append(aside); continue;
        }
        const next = passage(candidate.id);
        const button = element('button', 'choice'); button.type = 'button';
        button.setAttribute('aria-label', `${group.title}：到《${next.bookTitle}》，原空间第${candidate.rank}名`);
        button.append(element('span', 'label', group.title), element('span', 'excerpt', next.text), element('span', 'book', `《${next.bookTitle}》`), element('span', 'rank', `原空间第 ${candidate.rank} 名 · 模型cosine ${candidate.score.toFixed(3)} · 同段 ${count} 条`));
        button.addEventListener('click', () => { trail.push(candidate.id); render(true); });
        list.append(button);
    }
    $('dead-end').textContent = finished ? '这段试走已走满6步。你可以沿途返回，改走另一条岔路。' : available === 0 ? '走到这里：当前前16名中没有合格的跨书未见划线。可以沿途返回。' : '';
    updateMapSummary(); drawMap();
    if (focusPassage) $('passage-title').focus();
}
function reset() { trail = [$('seed').value]; render(true); }
async function start() {
    try {
        const response = await fetch('/viewer-data.json'); if (!response.ok) throw new Error('本机数据不可用');
        data = await response.json();
        if (data.schemaVersion !== 1 || !Array.isArray(data.seeds) || !data.seeds.length || data.publishedMap?.points?.length !== Object.keys(data.points).length) throw new Error('观察器数据格式不符');
        mapPointById = new Map(data.publishedMap.points.map((point) => [point.highlightId, point]));
        const picker = $('seed'); for (const id of data.seeds) picker.append(element('option', '', `${passage(id).bookTitle} · ${id}`));
        data.seeds.forEach((id, index) => { picker.options[index].value = id; });
        picker.value = data.seeds[0]; trail = [picker.value];
        picker.addEventListener('change', reset);
        $('restart').addEventListener('click', reset);
        $('back').addEventListener('click', () => { if (trail.length > 1) { trail.pop(); render(true); } });
        document.querySelectorAll('input[name="view"]').forEach((input) => input.addEventListener('change', () => { if (input.checked) setView(input.value); }));
        setView('text'); render();
        new ResizeObserver(drawMap).observe($('atlas'));
        window.__routeStudy = { get state() { return { view, trail: [...trail], currentId: current(), options: options().map((entry) => ({ band: entry.group.title, id: entry.candidate?.id ?? null, rank: entry.candidate?.rank ?? null })) }; }, get data() { return data; } };
    } catch (error) { $('load-status').textContent = error instanceof Error ? error.message : '观察器无法载入'; }
}
start();
