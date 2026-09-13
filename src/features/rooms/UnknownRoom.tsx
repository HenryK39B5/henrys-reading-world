import type { RoomRoute } from '../../app/router.ts';

/**
 * A path this build does not know.
 *
 * It stays quiet and escapable: no stack trace, no apology paragraph, just the fact and the way home.
 */
export function UnknownRoom({ path }: { path: string }) {
    return (
        <section className="room" aria-labelledby="unknown-heading" data-room="unknown">
            <h1 id="unknown-heading" className="room-heading" data-testid="room-heading">
                这里没有房间
            </h1>
            <p className="room-note" data-testid="unknown-note">
                {path} 不在这个阅读世界里。
            </p>
            <nav className="room-exits" aria-label="去别的房间">
                <a className="room-exit" href="/" data-testid="exit-hall">
                    回到随便看看
                </a>
                <a className="room-exit" href="/themes">
                    逛主题书架
                </a>
                <a className="room-exit" href="/books">
                    看看所有书
                </a>
            </nav>
        </section>
    );
}

/** Narrowing helper so callers can switch on the route without repeating the union. */
export type KnownRoute = Exclude<RoomRoute, { name: 'unknown' }>;
