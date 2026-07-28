import { parseCategory, type ParsedBilten, type ParsedEvent, type DisciplineCode } from "@shootermarkt/db/pdf-import-types";
import { normalizeDisciplineCode } from "@shootermarkt/db/discipline";

const GEMINI_API_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent";

const PROMPT = `Analiziraj ovaj streljački bilten i vrati JSON.

Razlikuj dva tipa biltena:
- NACIONALNI: rezultati pokazuju naziv kluba (npr. "SK Pančevo 1813", "ŽSK Beograd")
- INTERNACIONALNI/ISSF: rezultati pokazuju kod države/tima (SRB, GER, KOR, CHN, USA...)

Uzimaj SAMO ove discipline (ostale potpuno ignoriši — trap, skeet, 25m rapid fire,
50m free pistol, vazdušna puška/pištolj mix team, juniori, pioniri, veterani):
- ARM = vazdušna puška 10m seniori (muški)
- ARW = vazdušna puška 10m seniorke (ženske)
- APM = vazdušni pištolj 10m seniori (muški)
- APW = vazdušni pištolj 10m seniorke (ženske)
- R3PM = MK puška trostav 3x40 seniori (muški) — 50m, tri stava
- R3PW = MK puška trostav 3x40 seniorke (ženske) — 50m, tri stava
- SPW = 25m sport pištolj seniorke (ženske)

Za svaki event (tabela) u PDF-u izvuci:
- discipline: kod discipline (ARM/ARW/APM/APW/R3PM/R3PW/SPW)
- stage: "qualification" ili "final"
- category: uzrasna kategorija iz naslova tabele — "cadet" (kadet/U16), "youth_junior" (mlađi junior/U18), "junior" (junior/U21), "u23" (U23), "senior" (seniori/seniorke ili bez oznake). Default "senior".
- is_international: true ako su prikazane države kao timovi, false ako su klubovi
- results: lista strelaca sa poljima:
    rank — mesto (broj)
    bib_number — startni broj (opciono)
    last_name — prezime
    first_name — ime
    team_noc — UVEK prisutan: kod države (SRB, GER...) za internacionalna, ili kod/skraćenica države iz koje je strelac za nacionalna
    club_name — SAMO za nacionalna takmičenja: naziv ili skraćenica kluba; null za internacionalna
    birth_year — godina rođenja strelca kao 4-cifreni broj (npr. 2004) AKO je prisutna u biltenu (kolona "God.", "Rođ.", "YOB", datum rođenja → uzmi godinu); inače null
    series — niz serija kao decimalni/celi brojevi. Kvalifikacije u PDF biltenu
      imaju samo zbirove serija; nikada ne izračunavaj ili ne nagađaj pojedinačne
      hice iz tih zbirova. Za finale, ako postoje, ovo su zbirovi po fazi.
    series_labels — nazivi koji odgovaraju svakom članu niza series, samo za
      finale kada PDF jasno imenuje faze/serije; u suprotnom null.
    total — ukupan rezultat
    inners — broj centralnih desetki ("inner tens"), zapisan kao broj pored ukupnog rezultata sa oznakom x/X (npr. "23x" → 23). Prisutan kod Air Pistol (APM/APW) I MK puške trostav (R3PM/R3PW). Ako nema, null.
    qualified — true/false/null
    remark — oznaka pored rezultata umesto/pored "Q": "RPO" (strelac van nacionalne kvote, ne može u finale bez obzira na plasman), "DSQ" (diskvalifikacija), "DNS" (nije nastupio), "DNF" (nije završio). Null ako nema oznake.

Pravila:
- Ignoriši TEAM, MIXED TEAM i KONTROLNI MEČ tabele
- Za istu disciplinu vrati SVE uzrasne tabele kao ODVOJENE event-ove (senior, junior, kadet...), svaki sa svojim "category". NE spajaj i NE izostavljaj juniorsku tabelu.
- Air Rifle (ARM/ARW): decimalni skorovi u serijama (105.3), 6 serija
- Air Pistol (APM/APW): celi brojevi, ima inners (X count), 6 serija
- MK puška trostav (R3PM/R3PW): 50m, tri stava (klečeći/ležeći/stojeći), ukupno do 1200 (3x40); ima inner tens (npr. "1150 23x" → total 1150, inners 23); uzmi kvalifikacioni ukupan
  MK FINALE: pre eliminacije 8. i 7. strelca PDF prikazuje samo zbirne serije,
  NE pojedinačne hice: Klečeći (10 hitaca), Ležeći (10), Stojeći 1 (5) i
  Stojeći 2 (5). Vrati ih kroz series i series_labels baš tim redom. Tek posle
  eliminacije 8. i 7. strelca se hici pucaju pojedinačno: samo taj nastavak
  vrati kroz shots; cumulative čuva kumulativne vrednosti koje PDF prikazuje.
- Sport pištolj Ž (SPW): 25m, precizni + brzi deo, ukupno do 600. SPW FINALE
  u biltenu ima DVA reda brojeva po strelcu, bez pojedinačnih decimalnih hica:
  GORNJI red je kumulativni broj pogodaka, a DONJI red je broj pogodaka u toj
  seriji. Zato za SPW finale obavezno vrati cumulative iz gornjeg reda,
  series iz donjeg reda, shots kao null i total kao konačan broj pogodaka
  (celi broj, npr. 17 ili 22). Nikada ne izmišljaj decimalne pojedinačne hice.
- Finale: elimination format. Pored total i rank vrati, kada postoje u PDF-u:
  series (međuserije/faze), shots (pojedinačni hici finala) i cumulative
  (kumulativni rezultat posle svakog hica/faze). Ako bilten prikazuje samo
  konačan zbir, sva tri polja vrati kao null. Nikada ne izmišljaj vrednosti.
- Za nacionalna takmičenja: team_noc za srpske strelce je uvek "SRB"

Vrati SAMO JSON, bez markdown, bez teksta:
{
  "events": [
    {
      "discipline": "ARM",
      "stage": "qualification",
      "category": "senior",
      "is_international": false,
      "results": [
        {
          "rank": 1,
          "bib_number": 42,
          "last_name": "Petrović",
          "first_name": "Marko",
          "team_noc": "SRB",
          "club_name": "SK Pančevo 1813",
          "birth_year": 2004,
          "series": [105.3, 105.8, 103.6, 106.2, 104.3, 105.6],
          "total": 630.8,
          "inners": null,
          "qualified": true
        }
      ]
    }
  ]
}`;

interface GeminiResponse {
  candidates?: Array<{
    content?: { parts?: Array<{ text?: string }> };
  }>;
  error?: { message: string };
}

function cleanJson(raw: string): string {
  return raw
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
}

export async function parsePdfWithGemini(pdfBuffer: Buffer): Promise<ParsedBilten> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY not set");

  const body = {
    contents: [
      {
        parts: [
          { text: PROMPT },
          { inline_data: { mime_type: "application/pdf", data: pdfBuffer.toString("base64") } },
        ],
      },
    ],
    generationConfig: { responseMimeType: "application/json", temperature: 0.1 },
  };

  const res = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    let errMsg = `HTTP ${res.status}`;
    try {
      const errBody = await res.json() as { error?: { message?: string } };
      if (errBody?.error?.message) errMsg = errBody.error.message;
    } catch { /* ignore parse failure, use status code */ }
    if (res.status === 429) throw new Error(`Gemini API: prekoračen limit zahteva (rate limit). Pokušaj ponovo za nekoliko sekundi.`);
    if (res.status === 400) throw new Error(`Gemini API: neispravan zahtev (${errMsg}). PDF možda nije u podržanom formatu.`);
    throw new Error(`Gemini API greška (${errMsg})`);
  }

  const data = (await res.json()) as GeminiResponse;
  if (data.error) throw new Error(`Gemini API greška: ${data.error.message}`);

  const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
  if (!rawText.trim()) throw new Error("Gemini nije vratio nikakav sadržaj. Provjeri da li je PDF čitljiv i nije skeniran.");

  let parsed: {
    events: Array<{
      discipline: string;
      stage: string;
      category?: string;
      is_international?: boolean;
      results: Array<{
        rank: number;
        bib_number?: number;
        last_name: string;
        first_name: string;
        team_noc: string;
        club_name?: string | null;
        birth_year?: number | null;
        series?: number[] | null;
        series_labels?: string[] | null;
        shots?: number[] | null;
        cumulative?: number[] | null;
        total: number;
        inners?: number | null;
        qualified?: boolean | null;
        remark?: string | null;
      }>;
    }>;
  };
  try {
    parsed = JSON.parse(cleanJson(rawText)) as typeof parsed;
  } catch {
    const preview = rawText.length > 300 ? rawText.slice(0, 300) + "…" : rawText;
    throw new Error(`Gemini vratio neispravan JSON. Preview odgovora:\n${preview}`);
  }
  if (!Array.isArray(parsed?.events)) throw new Error("Gemini odgovor nema 'events' listu — format biltena možda nije prepoznat.");

  const events: ParsedEvent[] = parsed.events
    .map((e) => ({ ...e, discipline: normalizeDisciplineCode(e.discipline) }))
    .filter((e): e is typeof e & { discipline: DisciplineCode } => e.discipline !== null)
    .map((e) => ({
      discipline: e.discipline,
      stage: e.stage === "final" ? "final" : "qualification",
      category: parseCategory(e.category),
      isInternational: e.is_international ?? false,
      results: e.results.map((r) => ({
        rank: r.rank,
        bibNumber: r.bib_number,
        lastName: r.last_name,
        firstName: r.first_name,
        teamNoc: (r.team_noc ?? "").toUpperCase(),
        clubName: r.club_name ?? undefined,
        birthYear: r.birth_year ?? null,
        series: r.series ?? [],
        seriesLabels: r.series_labels ?? null,
        total: r.total,
        inners: r.inners ?? null,
        qualified: r.qualified ?? null,
        remark: r.remark ?? null,
        shots: r.shots ?? null,
        cumulative: r.cumulative ?? null,
      })),
    }));

  return { events, rawText };
}
