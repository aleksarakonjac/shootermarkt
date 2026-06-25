import type { ParsedBilten, ParsedEvent, DisciplineCode } from "./types";

const GEMINI_API_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent";

const PROMPT = `Analiziraj ovaj streljački bilten i vrati JSON.

Za svaki event (tabela) u PDF-u izvuci:
- discipline: kod discipline iz naslova tabele (ARM/ARW/APM/APW)
- stage: "qualification" ili "final"
- results: lista strelaca sa poljima:
    rank, bib_number (opciono), last_name, first_name, club_noc,
    series (niz serija kao decimalni brojevi),
    total (ukupan rezultat kao decimalni broj),
    inners (broj X ako postoji, inace null),
    qualified (true/false/null)

Pravila:
- Ignoriši TEAM, MIXED TEAM i KONTROLNI MEČ tabele.
- Uzmi SENIOR tabelu ako postoje i junior i senior lista za isti kod.
- Air Rifle (ARM/ARW): decimalni skorovi u serijama (npr. 105.3), total kao decimal.
- Air Pistol (APM/APW): celi brojevi u serijama, ima inners (X count).
- Finale: elimination format, kumulativni skorovi u total.

Vrati SAMO JSON objekat, bez markdown blokova, bez teksta pre ili posle:
{
  "events": [
    {
      "discipline": "ARM",
      "stage": "qualification",
      "results": [
        {
          "rank": 1,
          "bib_number": 42,
          "last_name": "Petrović",
          "first_name": "Marko",
          "club_noc": "SRB",
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
    content?: {
      parts?: Array<{ text?: string }>;
    };
  }>;
  error?: { message: string };
}

function cleanJson(raw: string): string {
  // Strip markdown code fences if Gemini wrapped it anyway
  return raw
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
}

export async function parsePdfWithGemini(
  pdfBuffer: Buffer
): Promise<ParsedBilten> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY not set");

  const base64Pdf = pdfBuffer.toString("base64");

  const body = {
    contents: [
      {
        parts: [
          { text: PROMPT },
          {
            inline_data: {
              mime_type: "application/pdf",
              data: base64Pdf,
            },
          },
        ],
      },
    ],
    generationConfig: {
      responseMimeType: "application/json",
      temperature: 0.1,
    },
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

  const rawText =
    data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";

  const parsed = JSON.parse(cleanJson(rawText)) as {
    events: Array<{
      discipline: string;
      stage: string;
      results: Array<{
        rank: number;
        bib_number?: number;
        last_name: string;
        first_name: string;
        club_noc?: string;
        series: number[];
        total: number;
        inners?: number | null;
        qualified?: boolean | null;
      }>;
    }>;
  };

  const events: ParsedEvent[] = parsed.events
    .filter((e) =>
      ["ARM", "ARW", "APM", "APW"].includes(e.discipline.toUpperCase())
    )
    .map((e) => ({
      discipline: e.discipline.toUpperCase() as DisciplineCode,
      stage: e.stage === "final" ? "final" : "qualification",
      results: e.results.map((r) => ({
        rank: r.rank,
        bibNumber: r.bib_number,
        lastName: r.last_name,
        firstName: r.first_name,
        clubNoc: r.club_noc,
        series: r.series ?? [],
        total: r.total,
        inners: r.inners ?? null,
        qualified: r.qualified ?? null,
      })),
    }));

  return { events, rawText };
}
