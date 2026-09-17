/**
 * savedsessions.ts
 *
 * Persistence for hosted game sessions.
 *
 *  - SessionStore keeps the host's most recent game sessions (an LRU capped at
 *    SESSION_CAPACITY) so a game can be resumed after a reload or crash. In the
 *    browser it is backed by IndexedDB; tests use the in-memory backend.
 *  - createSaveFile / parseSaveFile define the portable .mpsave file format.
 */

export const SESSION_CAPACITY = 5;

export const SAVE_FILE_FORMAT = 'multiplayr-save';
export const SAVE_FILE_VERSION = 1;
export const SAVE_FILE_EXTENSION = '.mpsave';

export interface SavedSession {
    sessionId: string;   // one entry per hosted room
    ruleName: string;    // key into MPRULES
    roomId: string;
    clientId: string;    // host's client id (also the room id under WebRTC)
    gameState: string;   // GameObject.getState() output
    players: string[];   // display names, for the resume list
    updatedAt: number;   // epoch ms; drives LRU ordering
}

export interface SaveFile {
    format: string;
    version: number;
    savedAt: number;
    ruleName: string;
    roomId: string;
    clientId: string;
    players: string[];
    gameState: any;      // parsed state object, kept readable in the file
}

export interface SessionBackend {
    getAll(): Promise<SavedSession[]>;
    put(session: SavedSession): Promise<void>;
    delete(sessionId: string): Promise<void>;
}

/**
 * Given the stored sessions, return the ids to evict so that at most
 * `capacity` of the most recently updated sessions remain.
 */
export function selectEvictions(
    sessions: { sessionId: string, updatedAt: number }[],
    capacity: number
): string[] {
    return sortByRecency(sessions)
        .slice(Math.max(0, capacity))
        .map((s) => s.sessionId);
}

function sortByRecency<T extends { sessionId: string, updatedAt: number }>(sessions: T[]): T[] {
    return sessions.slice().sort((a, b) =>
        (b.updatedAt - a.updatedAt) || a.sessionId.localeCompare(b.sessionId));
}

export class SessionStore {
    private backend: SessionBackend;
    private capacity: number;
    private now: () => number;
    private lastStamp = 0;

    // Autosave coalescing: at most one write in flight; while it runs, only the
    // latest queued snapshot per session is kept.
    private pending: { [sessionId: string]: SavedSession } = {};
    private writing: Promise<void> | null = null;

    constructor(
        backend: SessionBackend,
        capacity: number = SESSION_CAPACITY,
        now: () => number = () => Date.now()
    ) {
        this.backend = backend;
        this.capacity = capacity;
        this.now = now;
    }

    /** Most recently used first. Waits for queued autosaves to land. */
    public async list(): Promise<SavedSession[]> {
        await this.flush();
        return sortByRecency(await this.backend.getAll());
    }

    public async get(sessionId: string): Promise<SavedSession | null> {
        const sessions = await this.list();
        return sessions.find((s) => s.sessionId === sessionId) || null;
    }

    /** Store a session as the most recently used one, evicting the oldest beyond capacity. */
    public async save(session: Omit<SavedSession, 'updatedAt'> & { updatedAt?: number }): Promise<void> {
        await this.flush();
        await this.write({ ...session, updatedAt: this.stamp() });
    }

    /** Mark a session as most recently used without changing its state. */
    public async touch(sessionId: string): Promise<void> {
        const session = await this.get(sessionId);
        if (session) {
            await this.write({ ...session, updatedAt: this.stamp() });
        }
    }

    public async remove(sessionId: string): Promise<void> {
        await this.flush();
        await this.backend.delete(sessionId);
    }

    /** Fire-and-forget save used by the per-tick autosave. */
    public queue(session: Omit<SavedSession, 'updatedAt'>) {
        this.pending[session.sessionId] = { ...session, updatedAt: this.stamp() };
        if (!this.writing) {
            this.writing = this.drain();
        }
    }

    public flush(): Promise<void> {
        return this.writing || Promise.resolve();
    }

    // Strictly increasing, so saves within the same millisecond still have a
    // well-defined recency order.
    private stamp(): number {
        this.lastStamp = Math.max(this.now(), this.lastStamp + 1);
        return this.lastStamp;
    }

    private async drain(): Promise<void> {
        try {
            let ids = Object.keys(this.pending);
            while (ids.length > 0) {
                const next = this.pending[ids[0]];
                delete this.pending[ids[0]];
                try {
                    await this.write(next);
                } catch (e) {
                    console.error('Failed to autosave game session', e);
                }
                ids = Object.keys(this.pending);
            }
        } finally {
            this.writing = null;
        }
    }

    private async write(session: SavedSession): Promise<void> {
        await this.backend.put(session);
        const evict = selectEvictions(await this.backend.getAll(), this.capacity);
        for (const sessionId of evict) {
            await this.backend.delete(sessionId);
        }
    }
}

export class MemorySessionBackend implements SessionBackend {
    private sessions: { [sessionId: string]: SavedSession } = {};

    public async getAll() {
        return Object.keys(this.sessions).map((id) => ({ ...this.sessions[id] }));
    }

    public async put(session: SavedSession) {
        this.sessions[session.sessionId] = { ...session };
    }

    public async delete(sessionId: string) {
        delete this.sessions[sessionId];
    }
}

const DB_NAME = 'multiplayr';
const DB_VERSION = 1;
const STORE_NAME = 'sessions';

export class IndexedDBSessionBackend implements SessionBackend {
    private db: Promise<IDBDatabase> | null = null;

    public async getAll(): Promise<SavedSession[]> {
        const db = await this.open();
        return requestToPromise<SavedSession[]>(
            db.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).getAll());
    }

    public async put(session: SavedSession): Promise<void> {
        const db = await this.open();
        const tx = db.transaction(STORE_NAME, 'readwrite');
        tx.objectStore(STORE_NAME).put(session);
        await transactionDone(tx);
    }

    public async delete(sessionId: string): Promise<void> {
        const db = await this.open();
        const tx = db.transaction(STORE_NAME, 'readwrite');
        tx.objectStore(STORE_NAME).delete(sessionId);
        await transactionDone(tx);
    }

    private open(): Promise<IDBDatabase> {
        if (!this.db) {
            this.db = new Promise<IDBDatabase>((resolve, reject) => {
                const req = indexedDB.open(DB_NAME, DB_VERSION);
                req.onupgradeneeded = () => {
                    if (!req.result.objectStoreNames.contains(STORE_NAME)) {
                        req.result.createObjectStore(STORE_NAME, { keyPath: 'sessionId' });
                    }
                };
                req.onsuccess = () => resolve(req.result);
                req.onerror = () => reject(req.error);
            });
            this.db.catch(() => { this.db = null; });
        }
        return this.db;
    }
}

function requestToPromise<T>(req: IDBRequest): Promise<T> {
    return new Promise<T>((resolve, reject) => {
        req.onsuccess = () => resolve(req.result as T);
        req.onerror = () => reject(req.error);
    });
}

function transactionDone(tx: IDBTransaction): Promise<void> {
    return new Promise<void>((resolve, reject) => {
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error);
    });
}

let browserStore: SessionStore | null = null;

/**
 * The browser-wide session store, or null where IndexedDB is unavailable
 * (tests, private modes that block it). On first use it imports a game left
 * behind by the old single-slot localStorage autosave.
 */
export function getSessionStore(): SessionStore | null {
    if (typeof indexedDB === 'undefined') {
        return null;
    }
    if (!browserStore) {
        browserStore = new SessionStore(new IndexedDBSessionBackend());
        migrateLegacyLocalStorage(browserStore);
    }
    return browserStore;
}

function migrateLegacyLocalStorage(store: SessionStore) {
    try {
        const gameState = localStorage.getItem('gameState');
        const roomId = localStorage.getItem('roomId');
        const clientId = localStorage.getItem('clientId');
        const ruleName = localStorage.getItem('ruleName');
        if (!gameState) {
            return;
        }
        localStorage.removeItem('gameState');
        if (roomId && clientId && ruleName) {
            store.queue({ sessionId: roomId, ruleName, roomId, clientId, gameState, players: [] });
        }
    } catch (e) {
        console.warn('Could not migrate legacy saved game', e);
    }
}

export function createSaveFile(session: Omit<SavedSession, 'sessionId' | 'updatedAt'>, savedAt: number = Date.now()): SaveFile {
    return {
        format: SAVE_FILE_FORMAT,
        version: SAVE_FILE_VERSION,
        savedAt,
        ruleName: session.ruleName,
        roomId: session.roomId,
        clientId: session.clientId,
        players: session.players.slice(),
        gameState: JSON.parse(session.gameState)
    };
}

/**
 * Parse and validate .mpsave file contents into a session ready to be stored.
 * Throws an Error with a user-presentable message if the file is not usable.
 */
export function parseSaveFile(text: string): Omit<SavedSession, 'updatedAt'> {
    let data: any;
    try {
        data = JSON.parse(text);
    } catch (e) {
        throw new Error('This file is not a Multiplayr save (it is not valid JSON).');
    }

    if (!data || typeof data !== 'object' || data.format !== SAVE_FILE_FORMAT) {
        throw new Error('This file is not a Multiplayr save.');
    }
    if (typeof data.version !== 'number' || data.version > SAVE_FILE_VERSION) {
        throw new Error('This save was made by a newer version of Multiplayr.');
    }
    for (const field of ['ruleName', 'roomId', 'clientId']) {
        if (typeof data[field] !== 'string' || !data[field]) {
            throw new Error('This save file is incomplete (missing ' + field + ').');
        }
    }
    if (!data.gameState || typeof data.gameState !== 'object' || !data.gameState.hostStore) {
        throw new Error('This save file is incomplete (missing game state).');
    }

    return {
        sessionId: data.roomId,
        ruleName: data.ruleName,
        roomId: data.roomId,
        clientId: data.clientId,
        players: Array.isArray(data.players) ? data.players.filter((p: any) => typeof p === 'string') : [],
        gameState: JSON.stringify(data.gameState)
    };
}

export function saveFileName(file: SaveFile): string {
    const d = new Date(file.savedAt);
    const pad = (n: number) => (n < 10 ? '0' : '') + n;
    const stamp = d.getFullYear() + pad(d.getMonth() + 1) + pad(d.getDate()) +
        '-' + pad(d.getHours()) + pad(d.getMinutes());
    const room = file.roomId.replace(/^mp-/, '').replace(/[^a-zA-Z0-9_-]/g, '');
    const rule = file.ruleName.replace(/[^a-zA-Z0-9_-]/g, '');
    return 'multiplayr-' + rule + '-' + room + '-' + stamp + SAVE_FILE_EXTENSION;
}
