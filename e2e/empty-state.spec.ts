import { expect, test } from '@playwright/test';

/**
 * Public mode has no approved content yet. Every room must say so honestly instead of showing a
 * placeholder, a fake passage or a broken page.
 */
test('every room has an honest empty state in public mode', async ({ page }) => {
    const rooms = [
        { path: '/', heading: '随便看看', note: '目前没有可展示的划线。' },
        { path: '/themes', heading: '主题书架', note: '这里还没有可展示的真实划线' },
        { path: '/paths', heading: '主题小径', note: '目前还没有完成审核的主题小径' },
        { path: '/paths/tag-001', heading: '小径不存在', note: '不在当前收录范围内' },
        { path: '/map', heading: '阅读世界地图', note: '还没有生成可展示的地图' },
        { path: '/books', heading: '所有书', note: '这里没有可展示的书。' },
        { path: '/books/b-001', heading: '书不在收录范围', note: '不在收录范围内' },
        { path: '/themes/t-001', heading: '书架不存在', note: '不在收录范围内' },
        { path: '/about', heading: '关于', note: '这里收录了 0 处划线，来自 0 本书' },
        { path: '/nope', heading: '这里没有房间', note: '/nope' },
    ];

    for (const room of rooms) {
        await page.goto(room.path);
        await expect(page.getByTestId('room-heading')).toHaveText(room.heading);
        // No invented passage anywhere, and no private badge in public mode.
        await expect(page.getByTestId('stage-passage')).toHaveCount(0);
        expect(await page.locator('body').innerText()).toContain(room.note.split('　')[0] ?? room.note);
        await expect(page.getByText('仅本机 · 未公开审核')).toHaveCount(0);
        console.log(`${room.path}: ${room.heading}`);
    }

    // The navigation still works from the empty state.
    await page.goto('/');
    await page.getByTestId('exit-themes').click();
    await expect(page.getByTestId('room-heading')).toHaveText('主题书架');
});
