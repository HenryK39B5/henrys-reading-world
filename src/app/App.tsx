import { useEffect, useState } from 'react';
import { ReadingWorld } from './ReadingWorld.tsx';
import { StatusPanel, type LoadState } from './StatusPanel.tsx';
import { DATA_MODE, loadSnapshot } from './snapshotSource.ts';
import { useRouter } from './router.ts';
import { sitePath } from './sitePath.ts';
import { Nav } from './Nav.tsx';
import './page.css';
import '../features/rooms/rooms.css';

/**
 * The app shell.
 *
 * The navigation is part of the shell, so a loading or failing snapshot is still visible *inside* the
 * reading world and the visitor can walk to another room instead of hitting a dead end. Rooms decide for
 * themselves how an empty library looks.
 */
export function App() {
    const [state, setState] = useState<LoadState>({ status: 'loading' });
    const router = useRouter();

    useEffect(() => {
        let active = true;
        void loadSnapshot(DATA_MODE).then((result) => {
            if (active) {
                setState(result);
            }
        });
        return () => {
            active = false;
        };
    }, []);

    if (state.status === 'ready' || state.status === 'empty') {
        return <ReadingWorld snapshot={state.snapshot} warnings={state.warnings} router={router} />;
    }

    return (
        <div className="shell">
            <header className="site-header">
                <a className="brand" href={sitePath('/')}>
                    Henry's Reading World
                </a>
                <Nav route={router.route} />
            </header>
            {DATA_MODE === 'local' ? <p className="local-badge">仅本机 · 未公开审核</p> : null}
            <main id="room" className="room-region" tabIndex={-1}>
                <StatusPanel state={state} />
            </main>
        </div>
    );
}
