import { sitePath } from '../../app/sitePath.ts';

type ExplanationPage = 'about' | 'design' | 'technical';
const entries: { id: ExplanationPage; title: string; path: string }[] = [
    { id: 'about', title: '关于本站', path: '/about' },
    { id: 'design', title: '阅读方式', path: '/design' },
    { id: 'technical', title: '实现细节', path: '/design/technical' },
];

/** A quiet secondary navigation; explanation pages do not add more primary destinations. */
export function ExplanationNav({ current }: { current: ExplanationPage }) {
    return <nav className="explanation-nav" aria-label="网站介绍">
        {entries.map(entry => <a key={entry.id} href={sitePath(entry.path)}
            aria-current={entry.id === current ? 'page' : undefined}>{entry.title}</a>)}
    </nav>;
}
