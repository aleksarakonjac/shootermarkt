import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

function isAdmin(email: string | undefined) {
  return !!email && email === process.env.ADMIN_EMAIL;
}

const PROMPT = (text: string, from: string, to: string) => `\
You are translating a shooting competition name between Serbian and English.
Use standard ISSF terminology. Keep years, numbers, and round numbers unchanged.
Keep location names as-is (Serbian city names have no standard English equivalent).
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

SR: "ISSF Svetsko prvenstvo Puška/Pištolj"
EN: "ISSF World Championship Rifle/Pistol"

SR: "Seniorsko Prvenstvo Srbije, A program, 25m i 50m"
EN: "Serbian Championship Seniors, A program, 25/50m"

SR: "Regionalna Prvenstva, C program, 25/50/100m"
EN: "Serbian Regional Championships, C program, 25/50/100m"` : `\
EN: "ISSF Grand Prix 10m"
SR: "ISSF Grand Prix 10m"

EN: "European Championship Junior 10m"
SR: "Evropsko juniorsko prvenstvo 10m"

EN: "ISSF World Cup, Granada"
SR: "ISSF Svetski Kup, Granada"

EN: "ISSF World Championship Rifle/Pistol"
SR: "ISSF Svetsko prvenstvo Puška/Pištolj"

EN: "Serbian Championship Seniors, A program, 25/50m"
SR: "Seniorsko Prvenstvo Srbije, A program, 25m i 50m"

EN: "Serbian Regional Championships, C program, 25/50/100m"
SR: "Regionalna Prvenstva, C program, 25/50/100m"`}

Now translate this competition name from ${from === "sr" ? "Serbian" : "English"} to ${to === "en" ? "English" : "Serbian"}:

${text}`;

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!isAdmin(user?.email)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { text, from, to } = body as { text: string; from: string; to: string };

  if (!text?.trim() || !from || !to) {
    return NextResponse.json({ error: "text, from, to required" }, { status: 400 });
  }
  if (!["sr", "en"].includes(from) || !["sr", "en"].includes(to) || from === to) {
    return NextResponse.json({ error: "from/to must be sr or en and different" }, { status: 400 });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "GEMINI_API_KEY not set" }, { status: 500 });

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-lite:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: PROMPT(text.trim(), from, to) }] }],
        generationConfig: { maxOutputTokens: 150, temperature: 0.1 },
      }),
    }
  );

  if (!res.ok) {
    const err = await res.text();
    console.error("Gemini error:", err);
    return NextResponse.json({ error: "Gemini API error" }, { status: 502 });
  }

  const json = await res.json();
  const translated = json.candidates?.[0]?.content?.parts?.[0]?.text?.trim();

  if (!translated) {
    return NextResponse.json({ error: "No translation returned" }, { status: 502 });
  }

  return NextResponse.json({ translated });
}
