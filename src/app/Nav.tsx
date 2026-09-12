/**
 * Light navigation (docs/05 §1).
 *
 * Entries become links as their sections land: the stage exists now, the book, topic and about
 * sections arrive in Slice 3 and 4. Until then they are marked unavailable rather than rendered as
 * dead links, so nothing on the page invites a click that does nothing.
 */
type NavEntry = {
    id: string;
    label: string;
    available: boolean;
    /** Which slice opens the section; kept here so enabling one is a one-line change. */
    note?: string;
};

const ENTRIES: NavEntry[] = [
    { id: 'random', label: '随机', available: true },
    { id: 'books', label: '书', available: false, note: '书籍区域将在后续切片开放' },
    { id: 'topics', label: '主题', available: false, note: '主题区域将在后续切片开放' },
    { id: 'about', label: '关于', available: false, note: '关于区域将在后续切片开放' },
];

export function Nav() {
    return (
        <nav className="site-nav" aria-label="主要导航">
            <ul className="nav-list">
                {ENTRIES.map((entry) => (
                    <li key={entry.id}>
                        {entry.available ? (
                            <a className="nav-link" href={`#${entry.id}`} aria-current="page">
                                {entry.label}
                            </a>
                        ) : (
                            <span className="nav-link is-pending" aria-disabled="true" title={entry.note}>
                                {entry.label}
                            </span>
                        )}
                    </li>
                ))}
            </ul>
        </nav>
    );
}
