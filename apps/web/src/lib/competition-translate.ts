// LLM prevod naziva i lokacije takmičenja (sr <-> en).

const NAME_PROMPT = (text: string, from: string, to: string) => `\
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
- Trap → Trap
- Skeet → Skeet
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
- Trap → Trap
- Skeet → Skeet
- 10 Meter / 10m → 10m
- 25 Meter / 25m → 25m
- 50 Meter / 50m → 50m
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

const LOCATION_PROMPT = (text: string, from: string, to: string) => `\
You are translating the location of a shooting competition (usually "City, Country" or just a city) from ${from === "sr" ? "Serbian" : "English"} to ${to === "en" ? "English" : "Serbian"}.
Translate country names (China→Kina, Germany→Nemačka, France→Francuska, USA→SAD, Korea→Koreja, India→Indija, Russia→Rusija, Italy→Italija, Spain→Španija, Egypt→Egipat, Austria→Austrija, Croatia→Hrvatska, Hungary→Mađarska, Czech Republic→Češka, Poland→Poljska, Slovakia→Slovačka, Azerbaijan→Azerbejdžan, Serbia→Srbija, Bosnia and Herzegovina→Bosna i Hercegovina, Slovenia→Slovenija, Greece→Grčka, Turkey→Turska, Sweden→Švedska, Finland→Finska, Switzerland→Švajcarska, Belgium→Belgija, Netherlands→Holandija, Denmark→Danska, Norway→Norveška, Lithuania→Litvanija, Qatar→Katar, Kuwait→Kuvajt, Peru→Peru, Chile→Čile, Mexico→Meksiko).
Use the established local exchange form of well-known cities (Belgrade↔Beograd, Vienna↔Beč, Munich↔Minhen, Prague↔Prag, Warsaw↔Varšava, Cairo↔Kairo, Moscow↔Moskva, Zagreb↔Zagreb); otherwise keep the city name as-is.
If the text is already in the target form, return it unchanged.
Return ONLY the translated location — no explanations, no quotes.

Location: ${text}`;

export function detectLang(text: string): "sr" | "en" {
  return /[čćšđžČĆŠĐŽ]/.test(text) ? "sr" : "en";
}

export async function translateText(
  text: string,
  from: "sr" | "en",
  to: "sr" | "en",
  kind: "name" | "location" = "name",
): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY not set");
  const prompt = (kind === "name" ? NAME_PROMPT : LOCATION_PROMPT)(text.trim(), from, to);
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: process.env.OPENAI_TRANSLATE_MODEL ?? "gpt-4o-mini",
      temperature: 0.1,
      max_tokens: 300,
      messages: [{ role: "user", content: prompt }],
    }),
  });
  if (!res.ok) throw new Error(`OpenAI ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const json = await res.json();
  const out = json.choices?.[0]?.message?.content?.trim().replace(/^["„“]|["”“]$/g, "");
  if (!out) throw new Error("No translation returned");
  return out;
}
