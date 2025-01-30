type Option<T> = T | null;

type Result<T = object, E = string> =
  | {
      ok: true;
      data: T;
    }
  | {
      ok: false;
      err: E;
    };
