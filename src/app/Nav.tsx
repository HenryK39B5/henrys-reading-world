/**
 * Light navigation (docs/05 §1). Every entry now points at a section that exists.
 */
type NavEntry = {
    id: string;
    label: string;
};

const ENTRIES: NavEntry[] = [
    { id: 'random', label: '随机' },
    { id: 'books', label: '书' },
    { id: 'topics', label: '主题' },
    { id: 'about', label: '关于' },
];

export function Nav() {
    return (
        <nav className="site-nav" aria-label="主要导航">
            <ul className="nav-list">
                {ENTRIES.map((entry) => (
                    <li key={entry.id}>
                        <a className="nav-link" href={`#${entry.id}`} aria-current={entry.id === 'random' ? 'page' : undefined}>
                            {entry.label}
                        </a>
                    </li>
                ))}
            </ul>
        </nav>
    );
}
