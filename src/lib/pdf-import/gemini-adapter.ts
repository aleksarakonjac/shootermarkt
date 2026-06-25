import type { ParsedBilten, ParsedEvent, DisciplineCode } from "./types";

const GEMINI_API_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent";

const PROMPT = `Analiziraj ovaj streljački bilten i vrati JSON.

Razlikuj dva tipa biltena:
- NACIONALNI: rezultati pokazuju naziv kluba (npr. "SK Pančevo 1813", "ŽSK Beograd")
- INTERNACIONALNI/ISSF: rezultati pokazuju kod države/tima (SRB, GER, KOR, CHN, USA...)

Za svaki event (tabela) u PDF-u izvuci:
- discipline: kod discipline (ARM/ARW/APM/APW, ignoriši 50MRM, 25MP, trap, skeet itd.)
- stage: "qualification" ili "final"
- is_international: true ako su prikazane države kao timovi, false ako su klubovi
- results: lista strelaca sa poljima:
    rank — mesto (broj)
    bib_number — startni broj (opciono)
    last_name — prezime
    first_name — ime
    team_noc — UVEK prisutan: kod države (SRB, GER...) za internacionalna, ili kod/skraćenica države iz koje je strelac za nacionalna
    club_name — SAMO za nacionalna takmičenja: naziv ili skraćenica kluba; null za internacionalna
    series — niz serija kao decimalni/celi brojevi
    total — ukupan rezultat
    inners — broj X (samo Air Pistol, inače null)
    qualified — true/false/null

Pravila:
- Ignoriši TEAM, MIXED TEAM i KONTROLNI MEČ tabele
- Za SENIOR i JUNIOR isti discipline: uzmi SENIOR tabelu kao oficijalni rezultat
- Air Rifle (ARM/ARW): decimalni skorovi u serijama (105.3), 6 serija
- Air Pistol (APM/APW): celi brojevi, ima inners (X count), 6 serija
- Finale: elimination format, kumulativni ukupan
- Za nacionalna takmičenja: team_noc za srpske strelce je uvek "SRB"

Vrati SAMO JSON, bez markdown, bez teksta:
{
  "events": [
    {
      "discipline": "ARM",
      "stage": "qualification",
      "is_international": false,
      "results": [
        {
          "rank": 1,
          "bib_number": 42,
          "last_name": "Petrović",
          "first_name": "Marko",
          "team_noc": "SRB",
          "club_name": "SK Pančevo 1813",
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
    const err = await res.text();
    throw new Error(`Gemini API error ${res.status}: ${err}`);
  }

  const data = (await res.json()) as GeminiResponse;
  if (data.error) throw new Error(`Gemini error: ${data.error.message}`);

  const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
  const parsed = JSON.parse(cleanJson(rawText)) as {
    events: Array<{
      discipline: string;
      stage: string;
      is_international?: boolean;
      results: Array<{
        rank: number;
        bib_number?: number;
        last_name: string;
        first_name: string;
        team_noc: string;
        club_name?: string | null;
        series: number[];
        total: number;
        inners?: number | null;
        qualified?: boolean | null;
      }>;
    }>;
  };

  const VALID_CODES = new Set(["ARM", "ARW", "APM", "APW"]);

  const events: ParsedEvent[] = parsed.events
    .filter((e) => VALID_CODES.has(e.discipline.toUpperCase()))
    .map((e) => ({
      discipline: e.discipline.toUpperCase() as DisciplineCode,
      stage: e.stage === "final" ? "final" : "qualification",
      isInternational: e.is_international ?? false,
      results: e.results.map((r) => ({
        rank: r.rank,
        bibNumber: r.bib_number,
        lastName: r.last_name,
        firstName: r.first_name,
        teamNoc: (r.team_noc ?? "").toUpperCase(),
        clubName: r.club_name ?? undefined,
        series: r.series ?? [],
        total: r.total,
        inners: r.inners ?? null,
        qualified: r.qualified ?? null,
      })),
    }));

  return { events, rawText };
}
