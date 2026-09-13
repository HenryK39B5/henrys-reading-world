import { mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import { DEFAULT_ACCENT, accentFromPixels, hexToRgb, type Rgb } from '../src/domain/accent.ts';
import { sharePalette } from '../src/domain/sharePalette.ts';
import { hasSnapshot, loadSnapshot, nonWhitespace } from './support/snapshot.ts';

/**
 * V2-E4 evidence: the Book Aura share cards (docs/16 §7.4).
 *
 * Output goes to .private/review/v2-e4/ — a separate directory from the V2-E set, because these are a
 * different design and the older captures stay as the record of what was reviewed before.
 * Run with: `npm run capture:v2e4`.
 */
const OUT_DIR = join(process.cwd(), '.private/review/v2-e4');

test.use({ permissions: ['clipboard-read', 'clipboard-write'] });

/**
 * A room animates in, so a screenshot taken too early shows an empty page — and a card's colour is sampled
 * from a real cover, so a capture taken too early shows the default card. Both are waited for by observing
 * the page rather than by guessing a duration, then any remaining animation is frozen at its end state.
 */
/**
 * The pixel size of a PNG, read out of its IHDR chunk.
 *
 * Eight bytes of header are cheaper than a decoder dependency, and they settle the one question this file
 * cannot afford to get wrong: was the card captured whole? A locator screenshot of an element the dialog's
 * scroll port can only partly show comes back smaller than the element, or offset inside it, and both look
 * like a perfectly successful screenshot until someone opens the file.
 */
function pngSize(path: string): { width: number; height: number } {
    const header = readFileSync(path).subarray(0, 24);
    if (header.subarray(1, 4).toString('latin1') !== 'PNG') {
        throw new Error(`${path} is not a PNG`);
    }
    return { width: header.readUInt32BE(16), height: header.readUInt32BE(20) };
}

/**
 * Captures the card itself rather than the window around it, and proves the capture is the whole card.
 *
 * A long card is taller than the dialog's own scroll port, and the dialog deliberately scrolls itself to keep
 * the focused 复制文字 in view — so for a 398-character passage the card's own top ends up hundreds of pixels
 * above the window. A locator screenshot then comes back as a fragment, and the first pass shipped exactly
 * that: a 299-character card missing its top border and a 398-character card with the stage behind it in the
 * frame, both of which look like a successful capture until someone opens the file. Measured on this Chromium:
 * with the dialog as designed the card sits at y=-333, and it only reaches y=188 once the port is opened and
 * the dialog's own scroll position is returned to the top.
 *
 * Opening the port cannot flatter the design: it is the dialog that owns the 92svh ceiling, while the card's
 * width, its 4:5 default and the way a long passage grows it all come from the card's own rules. The frame is
 * then checked against the card's real box, so a fragment fails here instead of in review.
 */
async function shotCard(page: Page, name: string): Promise<void> {
    await settle(page);
    const card = page.getByTestId('share-card');
    const dialog = page.getByTestId('share-dialog');
    const lift = async (): Promise<void> => {
        await dialog.evaluate((node) => {
            node.style.setProperty('max-height', 'none');
            node.style.setProperty('overflow', 'visible');
            node.scrollTop = 0;
        });
    };
    const drop = async (): Promise<void> => {
        await dialog.evaluate((node) => {
            node.style.removeProperty('max-height');
            node.style.removeProperty('overflow');
        });
    };

    await lift();
    try {
        const box = await card.boundingBox();
        const viewport = page.viewportSize();
        if (box === null || viewport === null) {
            throw new Error(`${name}: the card has no box to capture`);
        }
        const bottom = box.y + box.height;
        if (box.y < 0 || bottom > viewport.height) {
            throw new Error(
                `${name}: the card spans y=${String(Math.round(box.y))}..${String(Math.round(bottom))} in a ${String(viewport.height)}px window, so the capture would be a fragment. Give the card shot a taller viewport.`,
            );
        }

        const path = join(OUT_DIR, `${name}.png`);
        await card.screenshot({ path, animations: 'disabled' });
        // Chromium's clip rectangle is the enclosing integer rect, so the frame may be a pixel larger than the
        // element on each side. Anything further off is a fragment, not rounding.
        const size = pngSize(path);
        expect(size.width, `${name} must be the whole card, not a fragment of it`).toBeGreaterThanOrEqual(
            Math.floor(box.width),
        );
        expect(size.width).toBeLessThanOrEqual(Math.ceil(box.width) + 1);
        expect(size.height, `${name} must be the whole card, not a fragment of it`).toBeGreaterThanOrEqual(
            Math.floor(box.height),
        );
        expect(size.height).toBeLessThanOrEqual(Math.ceil(box.height) + 1);
    } finally {
        await drop();
    }
}

/**
 * The room a card capture needs: tall enough for the longest real card (990px plus the dialog's padding, heading
 * and actions), and never narrower than 420px so the card keeps its desk rules instead of the phone ones.
 */
const CARD_SHOT_VIEWPORT = { width: 1440, height: 1500 };

/** Waits until the page has stopped moving on its own. */
async function settle(page: Page): Promise<void> {
    for (let pass = 0; pass < 6; pass += 1) {
        await page.evaluate(async () => {
            await new Promise((resolve) => {
                requestAnimationFrame(() => {
                    requestAnimationFrame(() => {
                        resolve(undefined);
                    });
                });
            });
        });
        const running = await page.evaluate(async () => {
            const animations = document.getAnimations().filter((animation) => animation.playState === 'running');
            await Promise.all(animations.map((animation) => animation.finished.catch(() => undefined)));
            return animations.length;
        });
        if (running === 0) {
            break;
        }
    }
}

async function shot(page: Page, name: string): Promise<void> {
    await settle(page);
    await page.screenshot({
        path: join(OUT_DIR, `${name}.png`),
        fullPage: false,
        animations: 'disabled',
    });
}

async function coverPixels(page: Page, source: string): Promise<Rgb[]> {
    return page.evaluate(async (url: string) => {
        const image = new Image();
        image.decoding = 'async';
        await new Promise((resolve) => {
            image.addEventListener('load', resolve, { once: true });
            image.addEventListener('error', resolve, { once: true });
            image.src = url;
        });
        const canvas = document.createElement('canvas');
        canvas.width = 16;
        canvas.height = 16;
        const context = canvas.getContext('2d', { willReadFrequently: true });
        if (context === null) {
            return [];
        }
        context.drawImage(image, 0, 0, 16, 16);
        const { data } = context.getImageData(0, 0, 16, 16);
        const pixels: { r: number; g: number; b: number }[] = [];
        for (let index = 0; index + 3 < data.length; index += 4) {
            if ((data[index + 3] ?? 0) < 200) {
                continue;
            }
            pixels.push({ r: data[index] ?? 0, g: data[index + 1] ?? 0, b: data[index + 2] ?? 0 });
        }
        return pixels;
    }, source);
}

async function expectedAccent(page: Page, coverPath: string): Promise<string> {
    const url = coverPath.startsWith('local-covers/')
        ? `/__local_cover/${coverPath.slice('local-covers/'.length)}`
        : `/${coverPath}`;
    return accentFromPixels(await coverPixels(page, url)) ?? DEFAULT_ACCENT;
}

/** The `rgb()` string the browser reports for a hex colour. */
function cssOf(hex: string): string {
    const rgb = hexToRgb(hex);
    if (rgb === null) {
        throw new Error(`not a colour: ${hex}`);
    }
    return `rgb(${String(rgb.r)}, ${String(rgb.g)}, ${String(rgb.b)})`;
}

async function painted(page: Page): Promise<{ accent: string; background: string }> {
    return page.getByTestId('share-card').evaluate((node) => ({
        accent: node.getAttribute('data-accent') ?? '',
        background: getComputedStyle(node).backgroundColor,
    }));
}

async function openCard(page: Page, highlightId: string): Promise<void> {
    await page.goto(`/?h=${encodeURIComponent(highlightId)}`);
    await expect(page.getByTestId('stage-passage')).toBeVisible();
    await page.getByTestId('share-open').click();
    await expect(page.getByTestId('share-dialog')).toBeVisible();
    // The surface arrives with the sampled cover and then travels to it over 600ms, so the card is read once
    // it has actually got there. Logging or capturing it earlier would show the default surface while
    // reporting the book's own colour — the failure mode is a screenshot that lies about the design.
    await expect
        .poll(
            async () => {
                const facts = await painted(page);
                return facts.background === cssOf(sharePalette(facts.accent).background);
            },
            { message: 'the card must be painted with its own palette', timeout: 8000 },
        )
        .toBe(true);
}

async function cardFacts(page: Page): Promise<string> {
    return page.getByTestId('share-card').evaluate((node) => {
        const style = getComputedStyle(node);
        return JSON.stringify({
            accent: node.getAttribute('data-accent'),
            background: style.backgroundColor,
            text: style.color,
            extended: node.getAttribute('data-extended'),
            overflowY: node.scrollHeight - node.clientHeight,
            overflowX: node.scrollWidth - node.clientWidth,
        });
    });
}

test.describe('V2-E4 evidence', () => {
    test.skip(!hasSnapshot, '需要 .private/local-snapshot.json 才能采集真实证据');

    test('the dialog, the cards, real book colours, 200%, a refused clipboard and reduced motion', async ({
        page,
    }) => {
        test.setTimeout(240_000);
        mkdirSync(OUT_DIR, { recursive: true });
        const data = loadSnapshot();
        const long299 = data.highlights.find((item) => nonWhitespace(item.text) === 299) ?? data.medium;

        // ---- the cards themselves: the shortest, an 18-character line, a medium one, 299 and the longest ----
        // The 18-character sample is looked up rather than invented: it is one of the real boundaries this
        // project has measured before, and the shortest passage in the snapshot is only 8 characters.
        const short18 = data.highlights.find((item) => nonWhitespace(item.text) === 18) ?? data.shortest;
        // A tall viewport for the cards only: the longest real card is around a thousand pixels, and a card that
        // cannot fit on screen cannot be photographed whole (see `shotCard`).
        await page.setViewportSize(CARD_SHOT_VIEWPORT);
        for (const [name, highlight] of [
            ['card-shortest', data.shortest],
            ['card-18', short18],
            ['card-medium', data.medium],
            ['card-299', long299],
            ['card-longest', data.longest],
        ] as const) {
            await openCard(page, highlight.id);
            console.log(`${name}: ${String(nonWhitespace(highlight.text))} chars ${await cardFacts(page)}`);
            await shotCard(page, name);
        }

        // ---- three cards from three real covers, so the Book Aura is visible as evidence ----
        const candidates: { id: string; coverPath: string; highlightId: string }[] = [];
        for (const book of data.books) {
            const highlight = data.firstOfBook.get(book.id);
            if (book.coverPath === undefined || highlight === undefined) {
                continue;
            }
            candidates.push({ id: book.id, coverPath: book.coverPath, highlightId: highlight.id });
            if (candidates.length === 12) {
                break;
            }
        }
        await page.goto('/');
        const accents = new Set<string>();
        let auraShot = 0;
        for (const candidate of candidates) {
            if (auraShot === 3) {
                break;
            }
            const accent = await expectedAccent(page, candidate.coverPath);
            if (accents.has(accent)) {
                continue;
            }
            accents.add(accent);
            auraShot += 1;
            await openCard(page, candidate.highlightId);
            console.log(
                `card-aura-${String(auraShot)}: ${candidate.id} accent ${accent} bg ${sharePalette(accent).background} ${await cardFacts(page)}`,
            );
            await shotCard(page, `card-aura-${String(auraShot)}`);
        }
        expect(auraShot).toBe(3);

        // ---- the dialog at desk and phone width ----
        await page.setViewportSize({ width: 1440, height: 900 });
        await openCard(page, data.medium.id);
        await shot(page, 'share-dialog-1440');

        await page.setViewportSize({ width: 390, height: 844 });
        await expect(page.getByTestId('share-dialog')).toBeVisible();
        await shot(page, 'share-dialog-390');

        // ---- 200% equivalence, with the card in view ----
        await page.setViewportSize({ width: 720, height: 450 });
        await openCard(page, long299.id);
        await shot(page, 'zoom-200-dialog');

        // ---- clipboard refused: the manual fallback, with the card still above it ----
        const failure = await page.context().newPage();
        await failure.addInitScript(() => {
            const clipboard = navigator.clipboard;
            if (clipboard !== undefined) {
                clipboard.writeText = () => Promise.reject(new Error('denied'));
            }
        });
        await failure.setViewportSize({ width: 1440, height: 900 });
        await failure.goto('/');
        await expect(failure.getByTestId('stage-passage')).toBeVisible();
        await failure.getByTestId('share-open').click();
        await expect(failure.getByTestId('share-dialog')).toBeVisible();
        await failure.getByTestId('share-copy-text').click();
        await expect(failure.getByTestId('share-status')).toHaveText('自动复制失败，请手动复制');
        await shot(failure, 'clipboard-failure-1440');
        await failure.close();

        // ---- reduced motion: the card simply is its colour ----
        const calm = await page.context().newPage();
        await calm.emulateMedia({ reducedMotion: 'reduce' });
        await calm.setViewportSize({ width: 1440, height: 900 });
        await calm.goto('/');
        await expect(calm.getByTestId('stage-passage')).toBeVisible();
        await calm.getByTestId('share-open').click();
        await expect(calm.getByTestId('share-dialog')).toBeVisible();
        await shot(calm, 'reduced-motion-1440');
        await calm.close();
    });
});

test.afterAll(() => {
    console.log(`V2-E4 evidence written to ${OUT_DIR}`);
});
