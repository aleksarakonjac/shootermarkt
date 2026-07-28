import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { db } from "@shootermarkt/db";
import { competitions } from "@shootermarkt/db/schema";
import { isNull, or } from "drizzle-orm";
import { eq } from "drizzle-orm";

function isAdmin(email: string | undefined) {
  return !!email && email === process.env.ADMIN_EMAIL;
}

function detectLang(text: string): "sr" | "en" {
  return /[čćšđžČĆŠĐŽ]/.test(text) ? "sr" : "en";
}

const PROMPT = (text: string, from: string, to: string) => `\
You are translating a shooting competition name between Serbian and English.
Use standard ISSF terminology. Keep years, numbers, and round numbers unchanged.
Translate country names (e.g. China→Kina, Germany→Nemačka, France→Francuska, USA→SAD, Korea→Koreja, India→Indija, Russia→Rusija, Italy→Italija, Spain→Španija, Egypt→Egipat, Brazil→Brazil, Japan→Japan, Australia→Australija, Austria→Austrija, Croatia→Hrvatska, Hungary→Mađarska, Czech→Češka, Poland→Poljska, Slovakia→Slovačka).
Keep city names as-is (no standard Serbian equivalent for most cities).
Return ONLY the translated name — no explanations, no quotes.

Terminology glossary (${from}→${to}):
${from === "sr" ? `
- Državno/Savezno/Republičko/Nacionalno/Srpsko/Srbije → National/Serbian
- Prvenstvo → Championship
- Kup → Cup
- Liga → League
- Kolo → Round
- Otvoreno / Otvoreni → Open
- Međunarodni / Međunarodno → International
- Juniorsko/Juniorski/Juniori → Junior
- Seniorsko/Seniori → Senior
- Vazdušna puška / vazdušnom puškom → Air Rifle
- Vazdušni pištolj / vazdušnim pištoljem → Air Pistol
- Vazdušno oružje → Air Rifle and Air Pistol
- MK puška → Smallbore Rifle
- Sport pištolj → Sport Pistol
- Slobodni pištolj → Free Pistol
- Brza vatra → Rapid Fire Pistol
- Memorijal → Memorial
- Turnir → Tournament
`.trim() : `
- National/Serbian → Državno/Srpsko/Srbije
- Championship → Prvenstvo
- Cup → Kup
- League → Liga
- Round → Kolo
- Open → Otvoreni
- International → Međunarodni
- Junior → Juniorski
- Senior → Senior
- Air Rifle → Vazdušna puška
- Air Pistol → Vazdušni pištolj
- Air Rifle and Air Pistol → Vazdušno oružje
- Smallbore Rifle → MK puška
- Sport Pistol → Sport pištolj
- Free Pistol → Slobodni pištolj
- Rapid Fire Pistol → Brza vatra
- Memorial → Memorijal
- Tournament → Turnir
`.trim()}

Examples:
${from === "sr" ? `\
SR: "ISSF Grand Prix 10m"
EN: "ISSF Grand Prix 10m"

SR: "Evropsko juniorsko prvenstvo 10m"
EN: "European Championship Junior 10m"

SR: "ISSF Svetski Kup, Granada"
EN: "ISSF World Cup, Granada"

SR: "Seniorsko Prvenstvo Srbije, A program, 25m i 50m"
EN: "Serbian Championship Seniors, A program, 25/50m"` : `\
EN: "ISSF Grand Prix 10m"
SR: "ISSF Grand Prix 10m"

EN: "European Championship Junior 10m"
SR: "Evropsko juniorsko prvenstvo 10m"

EN: "ISSF World Cup, Granada"
SR: "ISSF Svetski Kup, Granada"

EN: "Serbian Championship Seniors, A program, 25/50m"
SR: "Seniorsko Prvenstvo Srbije, A program, 25m i 50m"`}

Now translate this competition name from ${from === "sr" ? "Serbian" : "English"} to ${to === "en" ? "English" : "Serbian"}:

${text}`;

async function translate(text: string, from: "sr" | "en", to: "sr" | "en"): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY!;
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: PROMPT(text, from, to) }] }],
        generationConfig: { maxOutputTokens: 1000, temperature: 0.1, thinkingConfig: { thinkingBudget: 0 } },
        safetySettings: [
          { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" },
          { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
          { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
          { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
        ],
      }),
    }
  );
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Gemini ${res.status}: ${err.slice(0, 200)}`);
  }
  const json = await res.json();
  const result = json.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
  if (!result) throw new Error("No translation returned");
  return result;
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!isAdmin(user?.email)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "GEMINI_API_KEY not set" }, { status: 500 });

  const rows = await db
    .select({ id: competitions.id, name: competitions.name, nameSr: competitions.nameSr, nameEn: competitions.nameEn })
    .from(competitions)
    .where(or(isNull(competitions.nameSr), isNull(competitions.nameEn)));

  let translated = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const row of rows) {
    const lang = detectLang(row.name);
    const patch: { nameSr?: string; nameEn?: string } = {};

    try {
      if (!row.nameSr) {
        if (lang === "sr") {
          patch.nameSr = row.name;
        } else {
          patch.nameSr = await translate(row.name, "en", "sr");
        }
      }
      if (!row.nameEn) {
        if (lang === "en") {
          patch.nameEn = row.name;
        } else {
          patch.nameEn = await translate(row.name, "sr", "en");
        }
      }

      if (Object.keys(patch).length > 0) {
        await db.update(competitions).set(patch).where(eq(competitions.id, row.id));
        translated++;
      } else {
        skipped++;
      }
    } catch (e) {
      errors.push(`[${row.id}] ${row.name}: ${String(e)}`);
    }

    // Small delay to avoid rate limiting
    await new Promise((r) => setTimeout(r, 200));
  }

  return NextResponse.json({ translated, skipped, errors, total: rows.length });
}
