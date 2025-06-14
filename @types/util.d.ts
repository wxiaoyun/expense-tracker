type Result<T, E> = { ok: true; data: T } | { ok: false; err: E };
type Option<T> = T | null;