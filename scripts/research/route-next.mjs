import { deterministicNext, visibleForks } from '/route-next-rule.mjs';

const $ = (id) => document.getElementById(id);
let data; let trail = []; let mode = 'auto'; let byMapId;
const current = () => trail.at(-1);
const passage = (id) => { const value = data.points[id]; if (!value) throw new Error(`unknown highlight ${id}`); return value; };
function element(tag, className, text) {
    const node = document.createElement(tag); if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
}
function drawMap() {
    if (!data || !trail.length) return;
    const canvas = $('atlas'); const width = canvas.clientWidth; const height = canvas.clientHeight;
    if (!width || !height) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.round(width * dpr); canvas.height = Math.round(height * dpr);
    const ctx = canvas.getContext('2d'); if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, width, height);
    const size = Math.min(width, height) - 22; const ox = (width - size) / 2; const oy = (height - size) / 2;
    const at = (point) => ({ x: ox + point.x * size / 10_000, y: oy + point.y * size / 10_000 });
    for (const contour of data.publishedMap.contours) {
        ctx.strokeStyle = '#85b6aa'; ctx.globalAlpha = contour.level === 160 ? .2 : .12; ctx.lineWidth = .75; ctx.beginPath();
        for (const segment of contour.segments) {
            const left = at({ x: segment[0], y: segment[1] }); const right = at({ x: segment[2], y: segment[3] });
            ctx.moveTo(left.x, left.y); ctx.lineTo(right.x, right.y);
        }
        ctx.stroke();
    }
    ctx.globalAlpha = .38; ctx.fillStyle = '#8cb8ac';
    for (const point of data.publishedMap.points) { const pos = at(point); ctx.fillRect(pos.x, pos.y, 1.2, 1.2); }
    const automatic = deterministicNext(data, trail);
    if (mode === 'choose' && automatic.status === 'ready') {
        ctx.setLineDash([3, 5]); ctx.globalAlpha = .8; ctx.lineWidth = 1.2;
        const from = at(byMapId.get(current()));
        for (const fork of visibleForks(data, trail, automatic)) {
            if (!fork.candidate) continue;
            const to = at(byMapId.get(fork.candidate.id)); ctx.strokeStyle = fork.isDefault ? '#f0d396' : '#99d1c5';
            ctx.beginPath(); ctx.moveTo(from.x, from.y); ctx.lineTo(to.x, to.y); ctx.stroke();
            ctx.beginPath(); ctx.arc(to.x, to.y, 3.3, 0, Math.PI * 2); ctx.stroke();
        }
        ctx.setLineDash([]);
    }
    ctx.globalAlpha = 1; ctx.strokeStyle = '#f0d396'; ctx.lineWidth = 2.5; ctx.beginPath();
    trail.forEach((id, index) => { const point = at(byMapId.get(id)); if (!index) ctx.moveTo(point.x, point.y); else ctx.lineTo(point.x, point.y); });
    ctx.stroke();
    trail.forEach((id, index) => {
        const pos = at(byMapId.get(id)); ctx.fillStyle = index === trail.length - 1 ? '#f5da9f' : '#cde1d3';
        ctx.beginPath(); ctx.arc(pos.x, pos.y, index === trail.length - 1 ? 5.3 : 3.6, 0, Math.PI * 2); ctx.fill();
    });
}
function render(focusPassage = false) {
    const id = current(); const point = passage(id);
    $('book').textContent = point.bookTitle; $('point-id').textContent = id; $('text').textContent = point.text;
    $('progress').textContent = `${trail.length - 1} / 6 次抵达`;
    $('back').disabled = trail.length === 1;
    const trailList = $('trail'); trailList.replaceChildren();
    for (const [index, pointId] of trail.entries()) {
        const li = element('li'); const button = element('button', '', `${index === 0 ? '起点' : String(index).padStart(2, '0')} · ${passage(pointId).bookTitle}`);
        button.type = 'button'; button.setAttribute('aria-label', `回到第${index}站：《${passage(pointId).bookTitle}》`);
        if (index === trail.length - 1) button.setAttribute('aria-current', 'step');
        button.addEventListener('click', () => { trail = trail.slice(0, index + 1); render(true); });
        li.append(button); trailList.append(li);
    }
    if (trail.length === 1) $('edge-note').textContent = '';
    else {
        const previous = trail.at(-2); const from = byMapId.get(previous); const to = byMapId.get(id);
        const rank = data.neighbors[previous].findIndex((item) => item.id === id) + 1;
        const distance = Math.hypot(from.x - to.x, from.y - to.y) / (10_000 * Math.SQRT2);
        $('edge-note').textContent = `上一跳：原向量空间第 ${rank} 名；发布平面跨度约占对角线 ${(distance * 100).toFixed(1)}%。两者不是同一种距离，线不证明主题相同。`;
    }
    const automatic = deterministicNext(data, trail);
    $('auto-mode').hidden = mode !== 'auto'; $('choose-mode').hidden = mode !== 'choose';
    $('next').disabled = automatic.status !== 'ready';
    $('next').textContent = automatic.status === 'ready' ? '再读一句 →' : '本段没有下一句';
    $('end-status').textContent = automatic.status === 'dead-end' ? '当前前16名中没有合格的跨书未见划线。可以返回上一句。' :
        automatic.status === 'limit' ? '这段试走已到六步，可以沿途返回，换个方向。' : '';
    const forks = visibleForks(data, trail, automatic);
    $('choice-status').textContent = automatic.status === 'ready' ? `可选 ${forks.filter((fork) => !!fork.candidate).length} 个方向。标有「默认下一句」的是不预览时会读到的句子。` : '';
    const choices = $('choices'); choices.replaceChildren();
    for (const fork of forks) {
        if (!fork.candidate || automatic.status !== 'ready') {
            choices.append(element('div', 'choice unavailable', `${fork.title} · 此处没有可走的跨书句子`)); continue;
        }
        const target = passage(fork.candidate.id);
        const button = element('button', 'choice'); button.type = 'button';
        button.setAttribute('aria-label', `${fork.title}：到《${target.bookTitle}》，原空间第${fork.candidate.rank}名${fork.isDefault ? '，默认下一句' : ''}`);
        button.append(element('span', 'label', fork.title + (fork.isDefault ? ' · 默认下一句' : '')),
            element('span', 'excerpt', target.text), element('span', 'book', `《${target.bookTitle}》`),
            element('span', 'rank', `原空间第 ${fork.candidate.rank} 名 · 模型cosine ${fork.candidate.score.toFixed(3)}`));
        button.addEventListener('click', () => { trail.push(fork.candidate.id); render(true); });
        choices.append(button);
    }
    $('atlas').setAttribute('aria-label', `发布地图坐标上的已读路线，当前第${trail.length - 1}站；完整书籍与顺序见已读过的句子列表`);
    drawMap();
    if (focusPassage) $('passage-label').focus();
}
function reset() { trail = [$('seed').value]; render(true); }
async function start() {
    try {
        const response = await fetch('/viewer-data.json'); if (!response.ok) throw new Error('本机数据不可用');
        data = await response.json();
        if (data.schemaVersion !== 1 || data.inputSha256 !== 'ccef39e7410ba7dd1618a8038762933464dd35c45a98f5fa48fb5e8c02c53a7c' ||
            data.publishedMap?.points?.length !== 3462 || !Array.isArray(data.seeds) || data.seeds.length !== 11) throw new Error('冻结研究数据不匹配');
        byMapId = new Map(data.publishedMap.points.map((point) => [point.highlightId, point]));
        if (byMapId.size !== Object.keys(data.points).length) throw new Error('地图与原文ID不一致');
        const picker = $('seed');
        for (const id of data.seeds) { const option = element('option', '', `${passage(id).bookTitle} · ${id}`); option.value = id; picker.append(option); }
        picker.value = data.seeds[0]; trail = [picker.value];
        picker.addEventListener('change', reset);
        $('restart').addEventListener('click', reset);
        $('back').addEventListener('click', () => { if (trail.length > 1) { trail.pop(); render(true); } });
        $('next').addEventListener('click', () => {
            const result = deterministicNext(data, trail);
            if (result.status !== 'ready') return;
            trail.push(result.candidate.id); render(true);
        });
        document.querySelectorAll('input[name="mode"]').forEach((input) => input.addEventListener('change', () => {
            if (!input.checked) return; mode = input.value; render();
        }));
        render(); new ResizeObserver(drawMap).observe($('atlas'));
        window.__nextStudy = { get state() { const automatic = deterministicNext(data, trail); return { trail: [...trail], currentId: current(), mode, automatic,
            forks: visibleForks(data, trail, automatic).map((fork) => ({ band: fork.band, id: fork.candidate?.id ?? null, rank: fork.candidate?.rank ?? null, isDefault: fork.isDefault })) }; } };
    } catch (error) { $('load-status').textContent = error instanceof Error ? error.message : '本机观察器无法载入'; }
}
start();
