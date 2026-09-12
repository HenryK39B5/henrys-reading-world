import { useEffect, useState } from 'react';
import { ReadingWorldPage } from './ReadingWorldPage.tsx';
import { StatusPanel, type LoadState } from './StatusPanel.tsx';
import { DATA_MODE, loadSnapshot } from './snapshotSource.ts';
import './page.css';

export function App() {
    const [state, setState] = useState<LoadState>({ status: 'loading' });

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

    if (state.status === 'ready') {
        return <ReadingWorldPage snapshot={state.snapshot} warnings={state.warnings} />;
    }

    return (
        <div className="shell">
            <header className="site-header">
                <h1 className="brand">Henry's Reading World</h1>
            </header>
            {DATA_MODE === 'local' ? <p className="local-badge">仅本机 · 未公开审核</p> : null}
            <main className="status-area">
                <StatusPanel state={state} />
            </main>
        </div>
    );
}
