/**
 * Escape LIKE/ILIKE wildcards so `.ilike(column, escapeLikePattern(value))` is a
 * case-insensitive EXACT match. Unescaped, `_` matches any one character and `%`
 * any run — "a_min@x.com" would match "admin@x.com".
 */
export function escapeLikePattern(value: string): string {
  return value.replace(/[\\%_]/g, (char) => `\\${char}`);
}
