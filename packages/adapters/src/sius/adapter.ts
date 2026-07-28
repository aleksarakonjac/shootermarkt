const SIUS_BASE = "http://results.sius.com";
const MVP_EVENTS = new Set(["ARM", "ARW", "APM", "APW"]);
const CALLBACK_ID =
  "ctl00%24ctl00%24ContentPlaceHolder%24PageContentPlaceHolder%24ASPxGridViewShootEventFiles";

/** R3P disciplines have an elimination phase PDF in addition to qual. */
const R3P_EVENTS = new Set(["R3PM", "R3PW"]);

export interface SiusChampionship {
  guid: string;
  name: string;
  events: string[]; // subset of ARM/ARW/APM/APW available
}

/** Fetch all championships from results.sius.com with at least one MVP event. */
export async function fetchChampionships(): Promise<SiusChampionship[]> {
  const res = await fetch(`${SIUS_BASE}/Championships.aspx`, {
    headers: { "User-Agent": "Mozilla/5.0" },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`SIUS Championships fetch failed: ${res.status}`);
  const html = await res.text();
  return parseChampionshipsHtml(html);
}

function parseChampionshipsHtml(html: string): SiusChampionship[] {
  // Extract: href with guid+event, title with "Championship Name  City - DISCIPLINE"
  const pattern =
    /<a href="ShootEvent\.aspx\?Championship=([a-f0-9-]{36})&ShootEvent=([A-Z0-9]+)" title="([^"]+)"/g;

  const guidName = new Map<string, string>();
  const guidEvents = new Map<string, Set<string>>();

  let m;
  while ((m = pattern.exec(html)) !== null) {
    const [, guid, event, title] = m;
    if (!MVP_EVENTS.has(event)) continue;

    if (!guidEvents.has(guid)) guidEvents.set(guid, new Set());
    guidEvents.get(guid)!.add(event);

    if (!guidName.has(guid)) {
      // Title: "Championship Name  City - 10m DISCIPLINE DESCRIPTION"
      const name = title.replace(/\s+-\s+(?:10m|25m|50m|300m).*$/, "").trim();
      guidName.set(guid, name);
    }
  }

  return Array.from(guidEvents.entries()).map(([guid, events]) => ({
    guid,
    name: guidName.get(guid) ?? guid,
    events: Array.from(events).sort(),
  }));
}

/** Fetch all PDF file paths for a championship + event via DevExpress AJAX callback. */
async function fetchSiusFiles(guid: string, event: string): Promise<string[]> {
  const pageUrl = `${SIUS_BASE}/ShootEvent.aspx?Championship=${guid}&ShootEvent=${event}`;

  const pageRes = await fetch(pageUrl, {
    headers: { "User-Agent": "Mozilla/5.0" },
    cache: "no-store",
  });
  if (!pageRes.ok) return [];
  const html = await pageRes.text();

  const vsMatch = html.match(/name="__VIEWSTATE"[^>]*value="([^"]+)"/);
  const vsgMatch = html.match(/name="__VIEWSTATEGENERATOR"[^>]*value="([^"]+)"/);
  if (!vsMatch) return [];

  const viewState = vsMatch[1];
  const viewStateGen = vsgMatch?.[1] ?? "";

  const params = new URLSearchParams();
  params.set("__VIEWSTATE", viewState);
  params.set("__VIEWSTATEGENERATOR", viewStateGen);
  params.set("__CALLBACKID", CALLBACK_ID.replace(/%24/g, "$"));
  params.set("__CALLBACKPARAM", "c0:");

  const callbackRes = await fetch(pageUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": "Mozilla/5.0",
    },
    body: params.toString(),
    cache: "no-store",
  });
  if (!callbackRes.ok) return [];
  const body = await callbackRes.text();

  // Response: DX({'result':{'stateObject':{'keys':['path/to/file.pdf', ...], ...}}})
  const keysMatch = body.match(/"keys":\[([^\]]*)\]/);
  if (!keysMatch) return [];

  const keysRaw = keysMatch[1];
  const files: string[] = [];
  const filePattern = /'([^']+)'/g;
  let fm;
  while ((fm = filePattern.exec(keysRaw)) !== null) {
    files.push(fm[1]);
  }
  return files;
}

/** Get qual individual file path for a championship + event. */
export async function fetchQualFile(guid: string, event: string): Promise<string | null> {
  const files = await fetchSiusFiles(guid, event);
  // Q100000IA = Qualification Individual RankList (not team, not final)
  return files.find((f) => (f.split(/[\\/]/).pop() ?? "").startsWith("Q100000IA")) ?? null;
}

/**
 * Get elimination individual file path for a championship + R3P event.
 * E100000IA = Elimination Individual RankList (R3PM/R3PW only).
 * Returns null for non-R3P events or when the file is not present.
 */
export async function fetchElimFile(guid: string, event: string): Promise<string | null> {
  if (!R3P_EVENTS.has(event)) return null;
  const files = await fetchSiusFiles(guid, event);
  return files.find((f) => (f.split(/[\\/]/).pop() ?? "").startsWith("E100000IA")) ?? null;
}

/** Download a PDF from results.sius.com. */
export async function downloadSiusPdf(guid: string, filename: string): Promise<Buffer> {
  // Backslashes in filename must be URL-encoded
  const encodedFile = filename.replace(/\\/g, "%5C");
  const url = `${SIUS_BASE}/DownloadFile.aspx?Championship=${guid}&FileName=${encodedFile}`;

  const res = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0" },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`SIUS PDF download failed: ${res.status} ${url}`);

  const buf = await res.arrayBuffer();
  if (buf.byteLength < 100) throw new Error("SIUS: received empty or invalid PDF");
  return Buffer.from(buf);
}
