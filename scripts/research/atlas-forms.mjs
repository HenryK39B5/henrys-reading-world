import { deterministicNext } from '/route-next-rule.mjs';
import { bookIslandLayout, constellationEdges } from '/atlas-geometry.mjs';

const $ = (id) => document.getElementById(id);
const variant = location.pathname.split('/').at(-1);
const variants = {
    published: { title: '同一句，在已发布点云上行走。', intro: '对照图：沿用已发布二维点位和轮廓的简图。它不是线上WebGL地形的完整复现。每次只按一次继续读，地图视框和点位保持不动。', caption: '点＝单条真实划线；轮廓＝发布平面上的局部点密度；实线＝已走顺序，不是地形道路。' },
    stars: { title: '同一句，在星座间行走。', intro: '星座图：仍在已发布坐标上保留所有点，只有当前点前列的少量真实模型近邻以细线显现；不提前展示候选卡。粗线只标出你实际读过的轨迹。', caption: '细线＝当前点前列模型邻居（只画至多4条，并非全部候选），粗线＝实际已读顺序；都不证明同主题。' },
    islands: { title: '同一句，从一座书岛到另一座。', intro: '书岛图：每本书是一座大小随其已审核划线数增加的岛；岛的位置只是确定性的书籍索引，距离不表示语义近远。同书每条原文在岛内拥有稳定的小点。', caption: '一岛＝一本书；岛大小＝本书公开划线数（非阅读量）；岛间远近无语义，线只记跨书已走顺序。' },
};
if (!Object.hasOwn(variants, variant)) throw new Error('unknown atlas form');
const description = variants[variant];
$('chart-title').textContent = description.title; $('chart-explain').textContent = description.intro;
$('map-caption').textContent = description.caption;
let data; let trail = []; let islandLayout; let publishedPoints;
const current = () => trail.at(-1);
function node(tag, text) { const element = document.createElement(tag); element.textContent = text; return element; }
function drawMap() {
    if (!data || !trail.length) return;
    const canvas = $('atlas'); const width = canvas.clientWidth; const height = canvas.clientHeight;
    if (!width || !height) return;
    const dpr = Math.min(2, devicePixelRatio || 1); canvas.width = Math.round(width * dpr); canvas.height = Math.round(height * dpr);
    const ctx = canvas.getContext('2d'); if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, width, height);
    const size = Math.min(width, height) - 24;
    const toCanvas = (point) => ({ x: (width - size) / 2 + point.x * size / 10_000, y: (height - size) / 2 + point.y * size / 10_000 });
    const positions = variant === 'islands' ? islandLayout.byPoint : publishedPoints;
    const spot = (id) => toCanvas(positions[id]);
    if (variant === 'published') {
        for (const contour of data.publishedMap.contours) {
            ctx.strokeStyle = '#8db6ab'; ctx.globalAlpha = contour.level === 160 ? .19 : .12; ctx.lineWidth = .8; ctx.beginPath();
            for (const segment of contour.segments) {
                const a = toCanvas({ x: segment[0], y: segment[1] }); const b = toCanvas({ x: segment[2], y: segment[3] });
                ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y);
            }
            ctx.stroke();
        }
    }
    if (variant === 'islands') {
        const currentBook = data.points[current()].bookId;
        for (const island of islandLayout.islands) {
            const center = toCanvas(island); const radius = island.radius * size / 10_000;
            ctx.beginPath(); ctx.arc(center.x, center.y, radius, 0, Math.PI * 2);
            ctx.fillStyle = island.id === currentBook ? '#446c66' : '#244047'; ctx.globalAlpha = .95; ctx.fill();
            ctx.lineWidth = island.id === currentBook ? 1.7 : .6; ctx.strokeStyle = island.id === currentBook ? '#f4d79a' : '#83a7a0'; ctx.stroke();
        }
    }
    ctx.globalAlpha = variant === 'islands' ? .7 : variant === 'stars' ? .33 : .42;
    ctx.fillStyle = variant === 'islands' ? '#a7ccc2' : '#a2c8c1';
    for (const id of Object.keys(data.points)) { const pos = spot(id); ctx.beginPath(); ctx.arc(pos.x, pos.y, variant === 'islands' ? .75 : .85, 0, Math.PI * 2); ctx.fill(); }
    if (variant === 'stars') {
        const from = spot(current()); ctx.globalAlpha = .7; ctx.lineWidth = 1; ctx.strokeStyle = '#85d5c8';
        for (const edge of constellationEdges(data, current(), trail)) {
            const to = spot(edge.id); ctx.beginPath(); ctx.moveTo(from.x, from.y); ctx.lineTo(to.x, to.y); ctx.stroke();
            ctx.beginPath(); ctx.arc(to.x, to.y, 2.5, 0, Math.PI * 2); ctx.stroke();
        }
    }
    ctx.globalAlpha = 1; ctx.lineWidth = 2.1; ctx.strokeStyle = '#f4cf87'; ctx.beginPath();
    for (const [index, id] of trail.entries()) { const pos = spot(id); if (!index) ctx.moveTo(pos.x, pos.y); else ctx.lineTo(pos.x, pos.y); }
    ctx.stroke();
    for (const [index, id] of trail.entries()) {
        const pos = spot(id); ctx.beginPath(); ctx.arc(pos.x, pos.y, index === trail.length - 1 ? 5.8 : 3.9, 0, Math.PI * 2);
        ctx.fillStyle = index === trail.length - 1 ? '#ffe0a1' : '#c4e2d5'; ctx.fill();
        if (index === trail.length - 1) { ctx.beginPath(); ctx.arc(pos.x, pos.y, 9, 0, Math.PI * 2); ctx.strokeStyle = '#f4cf87'; ctx.lineWidth = 1; ctx.stroke(); }
    }
}
function render(focus = false) {
    const id = current(); const point = data.points[id];
    $('book').textContent = `《${point.bookTitle}》`; $('point-id').textContent = id; $('text').textContent = point.text;
    $('progress').textContent = `${trail.length - 1} / 6 次抵达`;
    $('map-current').textContent = `此刻：《${point.bookTitle}》 · ${id}`;
    $('back').disabled = trail.length <= 1;
    if (trail.length > 1) {
        const from = trail.at(-2); const rank = data.neighbors[from].findIndex((neighbor) => neighbor.id === id) + 1;
        $('edge-note').textContent = `上一跳：源句模型前16近邻第 ${rank} 名。${variant === 'islands' ? '书岛间距只来自书籍索引，不是主题距离。' : '模型排名与发布二维距离不是同一种度量。'}`;
    } else $('edge-note').textContent = '';
    const next = deterministicNext(data, trail); $('next').disabled = next.status !== 'ready';
    $('next').textContent = next.status === 'ready' ? '再读一句 →' : '本段没有下一句';
    $('end-status').textContent = next.status === 'dead-end' ? '当前前16名中无合格的未读跨书句子，可以返回。' : next.status === 'limit' ? '这段试走已到六步，可以沿途返回。' : '';
    const list = $('trail'); list.replaceChildren();
    for (const [index, passageId] of trail.entries()) {
        const li = node('li', ''); const button = node('button', `${index === 0 ? '起点' : String(index).padStart(2, '0')} · ${data.points[passageId].bookTitle}`);
        button.type = 'button'; button.setAttribute('aria-label', `返回第${index}站：《${data.points[passageId].bookTitle}》`);
        if (index === trail.length - 1) button.setAttribute('aria-current', 'step');
        button.addEventListener('click', () => { trail = trail.slice(0, index + 1); render(true); });
        li.append(button); list.append(li);
    }
    $('atlas').setAttribute('aria-label', `固定${variant === 'islands' ? '书籍索引' : '发布点坐标'}图，第${trail.length - 1}站，当前《${point.bookTitle}》；完整路线和原文见文字区`);
    drawMap();
    if (focus) {
        const heading = $('passage-label'); heading.focus({ preventScroll: true });
        const bound = heading.getBoundingClientRect(); const map = document.querySelector('.map-pane').getBoundingClientRect();
        const overlap = innerWidth <= 650 ? map.bottom + 12 : 10;
        if (bound.top < overlap || bound.bottom > innerHeight - 20) heading.scrollIntoView({ block: 'start', behavior: 'instant' });
    }
}
async function start() {
    try {
        const response = await fetch('/viewer-data.json'); if (!response.ok) throw new Error('本机研究数据无法载入');
        data = await response.json();
        if (data.schemaVersion !== 1 || data.inputSha256 !== 'ccef39e7410ba7dd1618a8038762933464dd35c45a98f5fa48fb5e8c02c53a7c' ||
            Object.keys(data.points).length !== 3462 || data.publishedMap?.points?.length !== 3462 || data.seeds?.length !== 11) throw new Error('冻结数据不匹配');
        publishedPoints = Object.fromEntries(data.publishedMap.points.map((point) => [point.highlightId, point]));
        if (Object.keys(publishedPoints).length !== 3462) throw new Error('published point mismatch');
        islandLayout = bookIslandLayout(data.points);
        if (islandLayout.islands.length !== 108 || Object.keys(islandLayout.byPoint).length !== 3462) throw new Error('book island point mismatch');
        const picker = $('seed');
        for (const id of data.seeds) { const option = node('option', `${data.points[id].bookTitle} · ${id}`); option.value = id; picker.append(option); }
        picker.value = data.seeds[0]; trail = [picker.value];
        picker.addEventListener('change', () => { trail = [picker.value]; render(true); });
        $('reset').addEventListener('click', () => { trail = [picker.value]; render(true); });
        $('back').addEventListener('click', () => { if (trail.length > 1) { trail.pop(); render(true); } });
        $('next').addEventListener('click', () => { const next = deterministicNext(data, trail); if (next.status !== 'ready') return; trail.push(next.candidate.id); render(true); });
        render(); new ResizeObserver(drawMap).observe($('atlas'));
        window.__atlasStudy = { get state() { return { variant, trail: [...trail], next: deterministicNext(data, trail), currentPoint: variant === 'islands' ? islandLayout.byPoint[current()] : publishedPoints[current()], islandCount: islandLayout.islands.length }; } };
    } catch (error) { $('load-status').textContent = error instanceof Error ? error.message : '本机观察器无法载入'; }
}
start();
