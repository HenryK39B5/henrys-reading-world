import { deterministicNext } from '/route-next-rule.mjs';
import { compareTaggedPassages, lensMembership, weaveEvidence } from '/reading-story-rule.mjs';
const $ = (id) => document.getElementById(id);
let data; let overlay; let trail = []; let mapPoints; let bookIds;
const current = () => trail.at(-1);
function element(tag, text, className = '') { const node = document.createElement(tag); node.textContent = text; if (className) node.className = className; return node; }
const titles = (ids) => ids.map((id) => overlay.tags[id]);
const labels = (ids) => ids.length ? titles(ids).join(' · ') : '未见已审核主题标签（信息未知）';
const status = (relation) => relation.status === 'shared' ? `这两句有同名已审核主题：${titles(relation.shared).join('、')}；不等于观点相同。` :
    relation.status === 'disjoint' ? '两句均有已审核标签，但没有同名标签；不能因此认定内容无关。' :
        '至少一句缺少已审核主题标签；暂时无法比较标签，并不表示没有关联。';
function drawMap(lens = lensMembership(overlay.highlightTags, bookIds, current())) {
    const canvas = $('atlas'), width = canvas.clientWidth, height = canvas.clientHeight;
    if (!width || !height) return;
    const dpr = Math.min(2, devicePixelRatio || 1); canvas.width = Math.round(width * dpr); canvas.height = Math.round(height * dpr);
    const ctx = canvas.getContext('2d'); if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, width, height);
    const size = Math.min(width, height) - 24; const xy = ({ x, y }) => ({ x: (width - size) / 2 + x * size / 10_000, y: (height - size) / 2 + y * size / 10_000 });
    for (const contour of data.publishedMap.contours) {
        ctx.beginPath(); ctx.lineWidth = .7; ctx.globalAlpha = .1; ctx.strokeStyle = '#9bbab0';
        for (const segment of contour.segments) {
            const a = xy({ x: segment[0], y: segment[1] }); const b = xy({ x: segment[2], y: segment[3] });
            ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y);
        }
        ctx.stroke();
    }
    ctx.globalAlpha = .25; ctx.fillStyle = '#aec8bb';
    for (const point of data.publishedMap.points) { const pos = xy(point); ctx.fillRect(pos.x, pos.y, 1.2, 1.2); }
    if (lens.status === 'annotated') {
        ctx.globalAlpha = .8; ctx.fillStyle = '#c5e4cb';
        for (const id of lens.ids) { const pos = xy(mapPoints[id]); ctx.beginPath(); ctx.arc(pos.x, pos.y, 1.8, 0, Math.PI * 2); ctx.fill(); }
    }
    ctx.globalAlpha = 1; ctx.strokeStyle = '#efc992'; ctx.lineWidth = 2.2; ctx.beginPath();
    trail.forEach((id, index) => { const pos = xy(mapPoints[id]); if (index) ctx.lineTo(pos.x, pos.y); else ctx.moveTo(pos.x, pos.y); }); ctx.stroke();
    trail.forEach((id, index) => { const pos = xy(mapPoints[id]); ctx.fillStyle = index === trail.length - 1 ? '#ffde9f' : '#d9ead5'; ctx.beginPath(); ctx.arc(pos.x, pos.y, index === trail.length - 1 ? 5.4 : 3.4, 0, Math.PI * 2); ctx.fill(); });
}
function render(focus = false) {
    const id = current(), point = data.points[id], tagIds = overlay.highlightTags[id];
    $('book').textContent = `《${point.bookTitle}》`; $('point-id').textContent = id; $('text').textContent = point.text;
    $('progress').textContent = `${trail.length - 1} / 6 次抵达`;
    $('back').disabled = trail.length === 1;
    const chips = $('tags'); chips.replaceChildren();
    if (!tagIds.length) chips.append(element('span', '主题标签信息未知', 'unknown'));
    else for (const name of titles(tagIds)) chips.append(element('span', name));
    const lens = lensMembership(overlay.highlightTags, bookIds, id);
    $('lens-caption').textContent = lens.status === 'annotated' ?
        `共用当前任一已审核主题：${lens.ids.length} 条划线 · ${lens.books} 本书。非观点相同。` :
        '当前句标签未知；未标注不是没有主题，图上只显示路线。';
    $('atlas').setAttribute('aria-label', `固定发布地图坐标上的第${trail.length - 1}站，${lens.status === 'annotated' ? `有${lens.ids.length}条同标签划线、来自${lens.books}本书` : '当前标签未知'}；完整文字和已走路线见阅读区`);
    const previous = trail.at(-2);
    if (previous) {
        const relation = compareTaggedPassages(overlay.highlightTags, previous, id);
        $('arrival').dataset.kind = relation.status;
        $('arrival').textContent = `从《${data.points[previous].bookTitle}》来到《${point.bookTitle}》。${status(relation)}`;
        $('from-book').textContent = `上一句 · 《${data.points[previous].bookTitle}》 · ${previous}`;
        $('to-book').textContent = `这一句 · 《${point.bookTitle}》 · ${id}`;
        $('from-text').textContent = data.points[previous].text; $('to-text').textContent = point.text;
        $('from-tags').textContent = `已审核主题：${labels(relation.from)}`;
        $('to-tags').textContent = `已审核主题：${labels(relation.to)}`;
        const from = mapPoints[previous], to = mapPoints[id];
        const distance = Math.hypot(from.x - to.x, from.y - to.y) / (10_000 * Math.SQRT2);
        const rank = data.neighbors[previous].findIndex((candidate) => candidate.id === id) + 1;
        $('edge-note').textContent = `原空间模型近邻第 ${rank} 名；发布二维图上跨度 ${(distance * 100).toFixed(1)}% 对角线。两种度量不等同，也不能替读者解释原文。`;
        $('evidence').hidden = false;
    } else { $('arrival').textContent = ''; $('arrival').dataset.kind = ''; $('evidence').hidden = true; $('evidence').open = false; }
    const next = deterministicNext(data, trail);
    $('next').disabled = next.status !== 'ready'; $('next').textContent = next.status === 'ready' ? '再读一句 →' : '本段没有下一句';
    $('end-status').textContent = next.status === 'dead-end' ? '本次前16候选中已无合格的未读跨书划线；可以返回。' : next.status === 'limit' ? '已到六步，可以沿途回看。' : '';
    const list = $('trail'); list.replaceChildren(); const evidence = weaveEvidence(overlay.highlightTags, trail);
    for (const [index, trailId] of trail.entries()) {
        const li = document.createElement('li'), button = document.createElement('button');
        const incoming = evidence[index - 1]; if (incoming) li.dataset.link = incoming.status;
        button.type = 'button'; button.setAttribute('aria-label', `回到第${index}站：《${data.points[trailId].bookTitle}》${incoming ? `，${status(incoming)}` : ''}`);
        if (index === trail.length - 1) button.setAttribute('aria-current', 'step');
        button.append(element('span', index ? `第 ${index} 站` : '起点', 'step'), element('span', data.points[trailId].bookTitle),
            element('span', incoming ? incoming.status === 'shared' ? `同标签：${titles(incoming.shared).join('、')}` : incoming.status === 'disjoint' ? '有标签 · 无同名' : '标签未知' : '开始', 'connection'));
        button.addEventListener('click', () => { trail = trail.slice(0, index + 1); render(true); }); li.append(button); list.append(li);
    }
    drawMap(lens);
    if (focus) {
        const heading = $('passage-label'); heading.focus({ preventScroll: true });
        const bounds = heading.getBoundingClientRect(), map = document.querySelector('.world-pane').getBoundingClientRect();
        const overlap = innerWidth <= 650 ? map.bottom + 10 : 10;
        if (bounds.top < overlap || bounds.bottom > innerHeight - 18) heading.scrollIntoView({ block: 'start', behavior: 'instant' });
    }
}
async function start() {
    try {
        const [viewerResponse, overlayResponse] = await Promise.all([fetch('/viewer-data.json'), fetch('/reading-story-data.json')]);
        if (!viewerResponse.ok || !overlayResponse.ok) throw new Error('本机真实素材不可用');
        data = await viewerResponse.json(); overlay = await overlayResponse.json();
        const snapshotSha = 'ccef39e7410ba7dd1618a8038762933464dd35c45a98f5fa48fb5e8c02c53a7c';
        const viewerSha = 'f95cfa8bb830a9e2600fceeb69a7101910c85906f452d207dde04431f99fca6d';
        if (data.schemaVersion !== 1 || data.inputSha256 !== snapshotSha || overlay.schemaVersion !== 1 || overlay.snapshotSha256 !== snapshotSha || overlay.viewerSha256 !== viewerSha ||
            Object.keys(data.points).length !== 3462 || data.publishedMap?.points?.length !== 3462 || Object.keys(overlay.tags).length !== 56 ||
            Object.keys(overlay.highlightTags).length !== 3462 || data.seeds?.length !== 11) throw new Error('冻结研究材料不匹配');
        bookIds = Object.fromEntries(Object.values(data.points).map((point) => [point.id, point.bookId]));
        mapPoints = Object.fromEntries(data.publishedMap.points.map((point) => [point.highlightId, point]));
        if (Object.keys(mapPoints).length !== 3462 || Object.keys(bookIds).length !== 3462) throw new Error('原文与地图不能逐点对应');
        const picker = $('seed'); for (const id of data.seeds) { const option = element('option', `${data.points[id].bookTitle} · ${id}`); option.value = id; picker.append(option); }
        picker.value = data.seeds[0]; trail = [picker.value];
        picker.addEventListener('change', () => { trail = [picker.value]; render(true); });
        $('reset').addEventListener('click', () => { trail = [picker.value]; render(true); });
        $('back').addEventListener('click', () => { if (trail.length > 1) { trail.pop(); render(true); } });
        $('next').addEventListener('click', () => { const next = deterministicNext(data, trail); if (next.status !== 'ready') return; trail.push(next.candidate.id); render(true); });
        render(); new ResizeObserver(() => drawMap()).observe($('atlas'));
        window.__readingStory = { get state() { return { trail: [...trail], next: deterministicNext(data, trail), lens: lensMembership(overlay.highlightTags, bookIds, current()), evidence: weaveEvidence(overlay.highlightTags, trail) }; } };
    } catch (error) { $('load-status').textContent = error instanceof Error ? error.message : '本机试验无法载入'; }
}
start();
