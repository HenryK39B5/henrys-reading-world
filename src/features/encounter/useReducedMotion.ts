import { useEffect, useState } from 'react';

/** Tracks the visitor's motion preference and keeps up with changes while the page is open. */
export function useReducedMotion(): boolean {
    const [reduced, setReduced] = useState(
        () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    );

    useEffect(() => {
        const query = window.matchMedia('(prefers-reduced-motion: reduce)');
        const update = (matches: boolean) => {
            setReduced(matches);
        };
        const onChange = (event: MediaQueryListEvent) => {
            update(event.matches);
        };
        update(query.matches);
        query.addEventListener('change', onChange);
        return () => {
            query.removeEventListener('change', onChange);
        };
    }, []);

    return reduced;
}
