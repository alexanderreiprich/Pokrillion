/**
 * Reduces player input and aliases to a comparable key:
 * lowercase, no diacritics (é → e, ü → u), ß → ss, ♀/♂ → f/m, only [a-z0-9].
 *
 *   "Mr. Mime"  → "mrmime"
 *   "Pokémon"   → "pokemon"
 *   "Nidoran♀"  → "nidoranf"
 */
export function normalize(input: string): string {
  return input
    .toLowerCase()
    .replace(/♀/g, "f")
    .replace(/♂/g, "m")
    .replace(/ß/g, "ss")
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]/g, "");
}
