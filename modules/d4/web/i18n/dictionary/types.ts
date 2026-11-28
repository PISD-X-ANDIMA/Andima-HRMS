/**
 * Key: the text the code showed before the language toggle (English labels, Indonesian help text).
 * Entry: the other language, or both when the key itself is reworded. A missing language shows the key.
 * enOne: the English text when vars.count is 1 ("1 employee", not "1 employees"); Indonesian nouns have no plural form.
 */
export type Entry = { en?: string; id?: string; enOne?: string };
export type Dictionary = Record<string, Entry>;
