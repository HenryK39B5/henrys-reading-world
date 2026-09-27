const $ = (id) => document.getElementById(id);
const groups = [
    { title: '近端', start: 1, end: 4 },
    { title: '侧边', start: 5, end: 10 },
    { title: '外缘', start: 11, end: 16 },
];
let data; let trail = [];

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
    if (focusPassage) $('passage-title').focus();
}
function reset() { trail = [$('seed').value]; render(true); }
async function start() {
    try {
        const response = await fetch('/viewer-data.json'); if (!response.ok) throw new Error('本机数据不可用');
        data = await response.json();
        if (data.schemaVersion !== 1 || !Array.isArray(data.seeds) || !data.seeds.length) throw new Error('观察器数据格式不符');
        const picker = $('seed'); for (const id of data.seeds) picker.append(element('option', '', `${passage(id).bookTitle} · ${id}`));
        data.seeds.forEach((id, index) => { picker.options[index].value = id; });
        picker.value = data.seeds[0]; trail = [picker.value];
        picker.addEventListener('change', reset);
        $('restart').addEventListener('click', reset);
        $('back').addEventListener('click', () => { if (trail.length > 1) { trail.pop(); render(true); } });
        render();
        window.__routeStudy = { get state() { return { trail: [...trail], currentId: current(), options: options().map((entry) => ({ band: entry.group.title, id: entry.candidate?.id ?? null, rank: entry.candidate?.rank ?? null })) }; }, get data() { return data; } };
    } catch (error) { $('load-status').textContent = error instanceof Error ? error.message : '观察器无法载入'; }
}
start();
