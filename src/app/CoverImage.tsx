import { useState, type ReactNode } from 'react';
import { coverUrl } from './covers.ts';

export type CoverImageProps = {
    /** The book's real title, also used on a successfully loaded cover's image element. */
    title: string;
    coverPath: string | undefined;
    /** Class for the `<img>`; every room sizes its own cover. */
    className: string;
    /**
     * What the room shows instead of a cover. Passed in rather than decided here, because the four places
     * that show a cover each have their own shape for it.
     */
    fallback: ReactNode;
    /** Empty for a decorative cover; a real label when the cover is the only visual clue. */
    alt: string;
    loading?: 'lazy' | 'eager';
};

/**
 * A real cover, or the caller's honest missing-cover treatment.
 *
 * Two ways a cover can be missing: the snapshot never had one, or the file does not arrive. The second is
 * the one that used to leave a broken image on the page, so a failed load swaps in the same typographic
 * stand-in as a book without a cover (docs/05 §5).
 */
export function CoverImage({ title, coverPath, className, fallback, alt, loading }: CoverImageProps) {
    const [failed, setFailed] = useState(false);
    const url = coverUrl(coverPath);

    if (url === undefined || failed) {
        return <>{fallback}</>;
    }

    return (
        <img
            className={className}
            src={url}
            alt={alt}
            title={title}
            decoding="async"
            loading={loading}
            onError={() => {
                setFailed(true);
            }}
        />
    );
}
