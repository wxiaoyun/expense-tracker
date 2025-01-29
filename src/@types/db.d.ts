type BeforeCreate<T> = Omit<T, "id" | "created_at" | "updated_at">;

type BeforeUpdate<T> = Omit<T, "updated_at">;
