import { useEffect, useRef, useState } from 'react';
import type { Book } from '../../domain/types.ts';

type MapBookPickerProps = {
    books: Book[];
    selected: Book | undefined;
    accent: string;
    onSelect: (id: string | null) => void;
};

function BookChoices({ books, selected, onSelect, onDismiss }: Omit<MapBookPickerProps, 'accent'> & { onDismiss: () => void }) {
    const dialogRef = useRef<HTMLDialogElement>(null);
    const searchRef = useRef<HTMLInputElement>(null);
    const [query, setQuery] = useState('');
    const normalized = query.trim().toLocaleLowerCase();
    const matches = normalized === '' ? books : books.filter((book) =>
        `${book.title} ${book.author}`.toLocaleLowerCase().includes(normalized),
    );

    useEffect(() => {
        const dialog = dialogRef.current;
        if (dialog === null) return;
        dialog.showModal();
        searchRef.current?.focus({ preventScroll: true });
        return () => dialog.close();
    }, []);

    const choose = (id: string | null) => {
        onSelect(id);
        onDismiss();
    };

    return (
        <dialog
            ref={dialogRef}
            className="map-book-dialog"
            aria-labelledby="map-book-dialog-title"
            onKeyDown={(event) => {
                if (event.key === 'Escape') { event.preventDefault(); onDismiss(); }
            }}
            onCancel={(event) => { event.preventDefault(); onDismiss(); }}
        >
            <div className="map-book-dialog-head">
                <div>
                    <p className="room-kicker">阅读世界地图</p>
                    <h2 id="map-book-dialog-title">点亮一本书</h2>
                </div>
                <button type="button" className="map-book-dialog-close" aria-label="关闭选书" title="关闭选书" onClick={onDismiss}>×</button>
            </div>
            <input
                ref={searchRef}
                className="map-book-search"
                type="search"
                aria-label="搜索书名或作者"
                placeholder="搜索书名或作者"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
            />
            <p className="map-book-dialog-count" role="status">{matches.length} 本书</p>
            <div className="map-book-dialog-results">
                {normalized === '' ? (
                    <button type="button" className="map-book-choice" aria-current={selected === undefined ? 'true' : undefined} onClick={() => choose(null)}>
                        <span>整个世界</span><span aria-hidden="true">{selected === undefined ? '✓' : '↗'}</span>
                    </button>
                ) : null}
                {matches.length === 0 ? <p className="map-book-empty">没有找到这本书。</p> : null}
                {matches.map((book) => (
                    <button
                        type="button"
                        key={book.id}
                        className="map-book-choice"
                        aria-current={selected?.id === book.id ? 'true' : undefined}
                        onClick={() => choose(book.id)}
                    >
                        <span><strong>《{book.title}》</strong><small>{book.author}</small></span>
                        <span aria-hidden="true">{selected?.id === book.id ? '✓' : '↗'}</span>
                    </button>
                ))}
            </div>
        </dialog>
    );
}

export function MapBookPicker({ books, selected, accent, onSelect }: MapBookPickerProps) {
    const [open, setOpen] = useState(false);
    const triggerRef = useRef<HTMLButtonElement>(null);
    const dismiss = () => {
        setOpen(false);
        requestAnimationFrame(() => triggerRef.current?.focus({ preventScroll: true }));
    };
    return (
        <div className={`map-book-picker${selected === undefined ? '' : ' is-lit'}`} style={{ '--map-book-aura': accent } as React.CSSProperties}>
            <button
                ref={triggerRef}
                type="button"
                className="map-book-trigger"
                aria-label="点亮一本书"
                aria-haspopup="dialog"
                aria-expanded={open}
                onClick={() => setOpen(true)}
            >
                <span className="map-book-picker-orbit" aria-hidden="true" />
                <span>{selected === undefined ? '点亮一本书' : `《${selected.title}》`}</span>
                <span className="map-book-trigger-arrow" aria-hidden="true">⌄</span>
            </button>
            {open ? <BookChoices books={books} selected={selected} onSelect={onSelect} onDismiss={dismiss} /> : null}
        </div>
    );
}
