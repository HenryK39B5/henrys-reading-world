import type { TopicTag } from '../../domain/types.ts';
import { sitePath } from '../../app/sitePath.ts';

export type TopicCluesProps = {
    tags: TopicTag[];
    currentTagId?: string;
    onBeforeNavigate?: (tagId: string) => void;
    label?: string;
};

/** All equal-status clues of one passage, in snapshot editorial order. */
export function TopicClues({ tags, currentTagId, onBeforeNavigate, label = '线索' }: TopicCluesProps) {
    if (tags.length === 0) {
        return null;
    }
    return (
        <div className="topic-clues" data-testid="topic-clues">
            <span className="topic-clues-label">{label}</span>
            <span className="topic-clues-links">
                {tags.map((tag) => (
                    <a
                        key={tag.id}
                        className="topic-clue"
                        data-testid={`topic-clue-${tag.id}`}
                        href={sitePath(`/paths/${encodeURIComponent(tag.id)}`)}
                        aria-current={tag.id === currentTagId ? 'page' : undefined}
                        onClick={() => {
                            onBeforeNavigate?.(tag.id);
                        }}
                    >
                        #{tag.title}
                    </a>
                ))}
            </span>
        </div>
    );
}
