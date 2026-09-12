import { useEffect, useState } from 'react';
import { StatusPanel, type LoadState } from './StatusPanel.tsx';
import { DATA_MODE, loadSnapshot } from './snapshotSource.ts';
import './app.css';

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

    return (
        <div className="shell">
            <header className="brand-row">
                <span className="brand">Henry's Reading World</span>
                {DATA_MODE === 'local' ? <span className="badge">仅本机 · 未公开审核</span> : null}
            </header>
            <main className="status-area">
                <StatusPanel state={state} />
            </main>
        </div>
    );
}
