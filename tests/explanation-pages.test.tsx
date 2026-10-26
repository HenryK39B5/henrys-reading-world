import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import type { Snapshot } from '../src/domain/types.ts';
import { indexSnapshot } from '../src/domain/snapshot.ts';
import { AboutRoom } from '../src/features/rooms/AboutRoom.tsx';
import { TechnicalRoom } from '../src/features/rooms/TechnicalRoom.tsx';
import { DesignRoom } from '../src/features/rooms/DesignRoom.tsx';
const snapshot = JSON.parse(readFileSync('src/data/public-snapshot.json', 'utf8')) as Snapshot;
const index = indexSnapshot(snapshot);

describe('explanations follow actual scope and map contract', () => {
    it('public about describes approved scope without fixed private counts', () => {
        const html = renderToStaticMarkup(<AboutRoom index={index} />);
        expect(html).toContain('你现在看到的是单独审核过的公开内容');
        expect(html).not.toContain('你现在看到的是本机阅读范围');
        expect(html).toContain('aria-label="网站介绍"');
    });
    it('the released public map is explained using its actual algorithm', () => {
        const html = renderToStaticMarkup(<TechnicalRoom index={index} />);
        expect(html).toContain('data-explained-map="exact-neighbors"');
        expect(html).not.toContain('不重新运行 UMAP，也不为发布移动点位');
        expect(html).toContain('地图首次绘制就使用这份公开地形，不等待再次请求');
        expect(html).toContain('当前这张地图在本机直接计算原1024维');
    });
    it('scope and algorithm metadata independently select the correct explanation', () => {
        // Real approved originals/points; only contract metadata is varied, never used as product data.
        const localIndex = indexSnapshot({ ...snapshot, visibility: 'local-only',
            map: { ...snapshot.map!, version: 'exact-cosine-48-v1-contract-test' } });
        const html = renderToStaticMarkup(<TechnicalRoom index={localIndex} />);
        expect(html).toContain('data-explained-map="exact-neighbors"');
        expect(html).toContain('当前这张地图在本机直接计算原1024维');
        expect(html).toContain('当前是本机数据范围');
        expect(html).not.toContain('地图首次绘制就使用这份公开地形');
        expect(renderToStaticMarkup(<AboutRoom index={localIndex} />)).toContain('线上另用单独审核过的公开内容');
    });
    it('the reading explanation retains uncertainty and non-gamified reading', () => {
        const html = renderToStaticMarkup(<DesignRoom />);
        expect(html).toContain('没有必须读完的路线');
        expect(html).toContain('未标注的句子仍然参与整体地形');
        expect(html).toContain('公开版的完整收录内容仍会被下载');
        expect(html).toContain('访客浏览时不会调用模型');
    });
});
