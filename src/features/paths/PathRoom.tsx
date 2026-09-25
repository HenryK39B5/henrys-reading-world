import { pathProgress } from '../../domain/pathWalk.ts';
import { sitePath } from '../../app/sitePath.ts';
import type { SnapshotIndex } from '../../domain/snapshot.ts';
import { lengthBand } from '../../domain/length.ts';
import { relativeYearLabel } from '../../domain/timeLabel.ts';
import { TopicClues } from './TopicClues.tsx';
import type { PathRoomController } from '../rooms/usePathRoom.ts';

export type PathRoomProps = {
    index: SnapshotIndex;
    tagId: string;
    nowYear: number;
    room: PathRoomController;
    onOpenBook: (bookId: string) => void;
    onShare: (highlightId: string) => void;
};

export function PathRoom({ index, tagId, nowYear, room, onOpenBook, onShare }: PathRoomProps) {
    const tag = index.tagsById.get(tagId);
    const candidates = index.highlightsByTag.get(tagId) ?? [];
    const current = room.state.currentId === null ? undefined : index.highlightsById.get(room.state.currentId);
    const book = current === undefined ? undefined : index.booksById.get(current.bookId);

    if (tag === undefined || candidates.length === 0) {
        return (
            <section className="room" aria-labelledby="path-heading" data-room="path">
                <h1 id="path-heading" className="room-heading" data-testid="room-heading">
                    小径不存在
                </h1>
                <p className="room-note" data-testid="path-missing">
                    这条主题小径尚未完成审核，或不在当前收录范围内。
                </p>
                <nav className="room-exits" aria-label="去别的房间">
                    <a className="room-exit" href={sitePath('/paths')}>
                        回到主题小径
                    </a>
                    <a className="room-exit" href={sitePath('/')}>
                        随便看看
                    </a>
                </nav>
            </section>
        );
    }

    if (current === undefined || book === undefined) {
        return (
            <section className="room" aria-labelledby="path-heading" data-room="path">
                <h1 id="path-heading" className="room-heading">正在沿着：{tag.title}</h1>
                <p className="room-note">这条小径目前没有可展示的划线。</p>
            </section>
        );
    }

    const progress = pathProgress(room.state, index.snapshot.highlights);
    const tags = current.tagIds.map((id) => index.tagsById.get(id)).filter((value) => value !== undefined);
    const time = relativeYearLabel(current.year, nowYear);

    return (
        <section className="room room-path" aria-labelledby="path-heading" data-room="path" data-tag-id={tagId}>
            <header className="path-head">
                <div>
                    <p className="room-kicker">正在沿着</p>
                    <h1 id="path-heading" className="path-heading" data-testid="room-heading">
                        {tag.title}
                    </h1>
                </div>
            </header>
            <p className="sr-only" role="status" aria-live="polite">当前小径：{tag.title}</p>
            {tag.description === undefined ? null : <p className="path-definition">{tag.description}</p>}

            <article className="path-stage" data-band={lengthBand(current.text)} key={current.id}>
                <blockquote className="path-passage">
                    <p className="path-text" data-testid="path-passage">{current.text}</p>
                </blockquote>
                <p className="path-source">
                    <button type="button" className="path-book-link" onClick={() => onOpenBook(book.id)}>
                        《{book.title}》
                    </button>
                    <span className="path-author">{book.author}</span>
                    {time === null ? null : <span className="path-time">· {time}</span>}
                </p>
                <TopicClues
                    tags={tags}
                    currentTagId={tagId}
                    label={tags.length > 1 ? '岔路' : '线索'}
                    onBeforeNavigate={(nextTagId) => {
                        if (nextTagId !== tagId) {
                            room.branch(nextTagId);
                        }
                    }}
                />
            </article>

            <div className="path-footer">
                <div className="path-footer-meta">
                    <p className="path-progress" role="status" data-testid="path-progress">
                        这一程已遇见 {progress.seen} / {progress.total} 处
                    </p>
                    <details className="path-rhythm-disclosure" data-testid="path-rhythm-disclosure">
                        <summary>
                            <span>小径节奏</span>
                            <strong>{room.state.rhythm === 'uniform' ? '纯公平' : '有呼吸'}</strong>
                        </summary>
                        <div className="path-rhythm" role="group" aria-label="小径节奏">
                            <button
                                type="button"
                                className="path-rhythm-option"
                                aria-pressed={room.state.rhythm === 'uniform'}
                                onClick={() => room.setRhythm('uniform')}
                            >
                                纯公平
                            </button>
                            <button
                                type="button"
                                className="path-rhythm-option"
                                aria-pressed={room.state.rhythm === 'semantic'}
                                onClick={() => room.setRhythm('semantic')}
                            >
                                有呼吸
                            </button>
                        </div>
                    </details>
                </div>
                <div className="path-actions">
                    {progress.complete ? (
                        <button type="button" className="next-button" data-testid="path-restart" onClick={room.restart}>
                            重新走一遍
                        </button>
                    ) : (
                        <button type="button" className="next-button" data-testid="path-next" onClick={room.next}>
                            继续沿着「{tag.title}」走
                        </button>
                    )}
                    <button type="button" className="share-trigger" onClick={() => onShare(current.id)}>
                        分享
                    </button>
                </div>
                {progress.complete ? (
                    <p className="path-complete room-note" data-testid="path-complete">
                        这条小径暂时走到这里了。
                    </p>
                ) : null}
            </div>

            <nav className="room-exits" aria-label="小径房间的出口">
                <a className="room-exit" href={sitePath(`/map?tag=${encodeURIComponent(tag.id)}`)}>在地图中看这条小径</a>
                <a className="room-exit" href={sitePath('/paths')}>看看其他小径</a>
                <a className="room-exit" href={sitePath(`/books/${encodeURIComponent(book.id)}`)}>进入这本书</a>
                <a className="room-exit" href={sitePath('/')}>随便看看</a>
            </nav>
        </section>
    );
}
