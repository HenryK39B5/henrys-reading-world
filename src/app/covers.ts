import { useEffect, useState } from 'react';
import { accentFromPixels, DEFAULT_ACCENT, type Rgb } from '../domain/accent.ts';

const cache = new Map<string, string>();

function readCoverAccent(url: string): Promise<string | null> {
    return new Promise((resolvePromise) => {
        const image = new Image();
        image.decoding = 'async';
        image.addEventListener('load', () => {
            try {
                const canvas = document.createElement('canvas');
                const size = 16;
                canvas.width = size;
                canvas.height = size;
                const context = canvas.getContext('2d', { willReadFrequently: true });
                if (context === null) {
                    resolvePromise(null);
                    return;
                }
                context.drawImage(image, 0, 0, size, size);
                const { data } = context.getImageData(0, 0, size, size);
                const pixels: Rgb[] = [];
                for (let index = 0; index + 3 < data.length; index += 4) {
                    if ((data[index + 3] ?? 0) < 200) {
                        continue;
                    }
                    pixels.push({ r: data[index] ?? 0, g: data[index + 1] ?? 0, b: data[index + 2] ?? 0 });
                }
                resolvePromise(accentFromPixels(pixels));
            } catch {
                // A canvas readback can fail; the page keeps its default accent.
                resolvePromise(null);
            }
        });
        image.addEventListener('error', () => {
            resolvePromise(null);
        });
        image.src = url;
    });
}

/** Resolves a snapshot cover path into a URL the browser can load. */
export function coverUrl(coverPath: string | undefined): string | undefined {
    if (coverPath === undefined) {
        return undefined;
    }
    if (coverPath.startsWith('local-covers/')) {
        return `/__local_cover/${coverPath.slice('local-covers/'.length)}`;
    }
    return `/${coverPath}`;
}

/**
 * Accent colour derived from a real cover, sampled once per cover path.
 *
 * It returns the default accent until sampling succeeds, so no part of the page depends on an image
 * loading — and the colour always comes from the actual cover rather than a palette picked by hand.
 */
export function useCoverAccent(coverUrlValue: string | undefined): string {
    const [accent, setAccent] = useState(() =>
        coverUrlValue === undefined ? DEFAULT_ACCENT : (cache.get(coverUrlValue) ?? DEFAULT_ACCENT),
    );

    useEffect(() => {
        if (coverUrlValue === undefined) {
            setAccent(DEFAULT_ACCENT);
            return;
        }
        const cached = cache.get(coverUrlValue);
        if (cached !== undefined) {
            setAccent(cached);
            return;
        }
        let active = true;
        void readCoverAccent(coverUrlValue).then((sampled) => {
            const resolved = sampled ?? DEFAULT_ACCENT;
            cache.set(coverUrlValue, resolved);
            if (active) {
                setAccent(resolved);
            }
        });
        return () => {
            active = false;
        };
    }, [coverUrlValue]);

    return accent;
}
