declare module 'better-sqlite3-session-store' {
  import type { Store } from 'express-session';
  import type Database from 'better-sqlite3';
  function SqliteStoreFactory(session: { Store: typeof Store }): new (options: { client: Database.Database; expired?: { clear?: boolean; intervalMs?: number } }) => Store;
  export = SqliteStoreFactory;
}
