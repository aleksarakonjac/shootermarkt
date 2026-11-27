/**
 * PDF-ovi presloženi Ghostscript-om gube mapu slova: č, ć, đ… izlaze kao ! " # %, a CID fontovi (finala)
 * kao pomerena slova. Glifovi i dalje nose redne brojeve iz Arial fonta, pa se slovo vraća iz broja glifa.
 */
import { getResolvedPDFJS, type getDocumentProxy } from "unpdf";

type Page = Awaited<ReturnType<Awaited<ReturnType<typeof getDocumentProxy>>["getPage"]>>;
type Glyph = { unicode?: string; fontChar?: string; originalCharCode?: number };

// Arial: glifovi 3–97 su ASCII (znak = broj + 29), ostala slova po ovoj tabeli.
const LATIN = "Č253 č254 Ć251 ć252 Đ264 đ255 Š226 š227 Ž228 ž229 Á200 á105 É101 é112 Í203 í116 Ó207 ó121 Ö103 ö124 Ü104 ü129 Ő279 ő280 Ű293 ű294 Ř283 ř284 Ň277 ň278 Ě267 ě268 Ů291 ů292 Ý233 ý234 Ł224 ł225 Ś285 ś286 Ż297 ż298 Ą260 ą261 Ę265 ę266 Ä98 ä108 Å99 å110 Ç100 ç111 Ñ102 ñ120 Ľ271 ľ272 Ť289 ť290 Ď262 ď263 Ú210 ú126 Â198 â107 Î204 î118 Ă258 ă259 Ş249 ş250 Ţ287 ţ288";
const BY_GLYPH = new Map(LATIN.split(" ").map((entry) => [Number(entry.slice(1)), entry[0]]));
const arialChar = (glyph: number, shift = 0) => (glyph >= 3 && glyph <= 97 ? String.fromCharCode(glyph + 29) : BY_GLYPH.get(glyph - shift));
// Neke verzije Arial-a imaju slova pomerena za jedan glif. Pomak odaju Š š Ž ž, koje PDF daje kao ä ö é û.
const SHIFT_ANCHORS: Record<string, number> = { "ä": 226, "ö": 227, "é": 228, "û": 229 };

/** Znak fonta → redni broj glifa, iz cmap tabele (format 4) fonta koji pdf.js pripremi. */
function glyphIds(font: Uint8Array): (code: number) => number {
  const view = new DataView(font.buffer, font.byteOffset, font.byteLength);
  const u16 = (at: number) => view.getUint16(at);
  for (let i = 0; i < u16(4); i++) {
    const record = 12 + 16 * i;
    if (view.getUint32(record) !== 0x636d6170) continue; // "cmap"
    const cmap = view.getUint32(record + 8);
    for (let k = 0; k < u16(cmap + 2); k++) {
      const table = cmap + view.getUint32(cmap + 8 + 8 * k);
      if (u16(table) !== 4) continue;
      const size = u16(table + 6);
      return (code) => {
        for (let j = 0; j < size; j += 2) {
          const start = u16(table + 16 + size + j);
          if (code < start || code > u16(table + 14 + j)) continue;
          const delta = u16(table + 16 + 2 * size + j);
          const rangeAt = table + 16 + 3 * size + j;
          const range = u16(rangeAt);
          if (!range) return (code + delta) & 0xffff;
          const glyph = u16(rangeAt + range + 2 * (code - start));
          return glyph ? (glyph + delta) & 0xffff : 0;
        }
        return 0;
      };
    }
  }
  return () => 0;
}

/** Ispravke po fontu stranice (pogrešan znak → pravi). Prazno za fontove čija su slova već tačna ili nisu Arial. */
export async function glyphFixes(page: Page): Promise<Map<string, Map<string, string>>> {
  const { OPS } = await getResolvedPDFJS();
  const { fnArray, argsArray } = await page.getOperatorList();
  const used = new Map<string, Map<string, Required<Glyph>>>(); // font → unicode → glif
  let font = "";
  fnArray.forEach((fn, i) => {
    if (fn === OPS.setFont) font = argsArray[i][0];
    if (fn !== OPS.showText) return;
    const glyphs = used.get(font) ?? used.set(font, new Map()).get(font)!;
    for (const g of argsArray[i][0] as (Required<Glyph> | number)[]) if (typeof g === "object" && g?.unicode && g.fontChar) glyphs.set(g.unicode, g);
  });

  const fixes = new Map<string, Map<string, string>>();
  for (const [name, chars] of used) {
    const found = [...chars.values()];
    // CID font bez mape slova: "slova" su sami brojevi glifova (cifre izlaze kao kontrolni znaci).
    const raw = found.every((g) => g.unicode.charCodeAt(0) === g.originalCharCode) && found.some((g) => g.originalCharCode < 32);
    const data = page.commonObjs.has(name) ? (page.commonObjs.get(name) as { data?: Uint8Array }).data : undefined;
    if (!raw && !data) continue;
    const glyphOf = raw ? null : glyphIds(data!);
    const glyphs = found.map((g) => ({ unicode: g.unicode, glyph: glyphOf ? glyphOf(g.fontChar.codePointAt(0)!) : g.originalCharCode }));
    // Običan font: Arial raspored samo ako se već tačna ASCII slova slažu sa brojevima glifova.
    const ascii = glyphs.filter((g) => /^[A-Za-z0-9]$/.test(g.unicode));
    if (!raw && !(ascii.length && ascii.every((g) => arialChar(g.glyph) === g.unicode))) continue;
    const shift = glyphs.some((g) => g.glyph - SHIFT_ANCHORS[g.unicode] === 1) ? 1 : 0;
    const map = new Map(glyphs.flatMap((g) => {
      const real = arialChar(g.glyph, shift);
      return real && real !== g.unicode ? [[g.unicode, real] as const] : [];
    }));
    if (map.size) fixes.set(name, map);
  }
  return fixes;
}
