import type { RoomRoute } from './router.ts';

type NavEntry = {
    id: string;
    label: string;
    href: string;
};

const ENTRIES: NavEntry[] = [
    { id: 'hall', label: '随便看看', href: '/' },
    { id: 'themes', label: '主题书架', href: '/themes' },
    { id: 'paths', label: '主题小径', href: '/paths' },
    { id: 'map', label: '世界地图', href: '/map' },
    { id: 'books', label: '所有书', href: '/books' },
    { id: 'about', label: '关于', href: '/about' },
];

/** A shelf room highlights 主题书架; a book room highlights 所有书. */
function activeId(route: RoomRoute): string {
    switch (route.name) {
        case 'hall':
            return 'hall';
        case 'themes':
        case 'theme':
            return 'themes';
        case 'paths':
        case 'path':
            return 'paths';
        case 'map':
            return 'map';
        case 'books':
        case 'book':
            return 'books';
        case 'about':
            return 'about';
        case 'unknown':
            return '';
    }
}

/**
 * Light navigation between rooms (docs/12 §3). Every entry is a real link, so it can be opened in a new
 * tab, bookmarked and followed without JavaScript — the router only takes over the click.
 */
export function Nav({ route }: { route: RoomRoute }) {
    const current = activeId(route);
    return (
        <nav className="site-nav" aria-label="主要导航">
            <ul className="nav-list">
                {ENTRIES.map((entry) => (
                    <li key={entry.id}>
                        <a
                            className="nav-link"
                            href={entry.href}
                            data-testid={`nav-${entry.id}`}
                            aria-current={entry.id === current ? 'page' : undefined}
                        >
                            {entry.label}
                        </a>
                    </li>
                ))}
            </ul>
        </nav>
    );
}
