type Result<T, E = Error> = {
  ok: T;
  err: E;
};

type Option<T> = T | null;
