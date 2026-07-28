"use client";

import { useState, useEffect, useRef, useCallback, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useRouter } from "@/i18n/navigation";
import { Link } from "@/i18n/navigation";
import { useParams } from "next/navigation";
import Image from "next/image";
import { useLocale, useTranslations } from "next-intl";
import { LEVEL_STYLE, LEVEL_LABEL } from "@/lib/competition-utils";
import { useScopedHref } from "@/hooks/use-scoped-href";

// ── Shortcut detection ────────────────────────────────────────────────────────

type Shortcut = {
  icon: "filter" | "person" | "flag" | "location";
  label: string;
  href: string;
  countryCode2?: string;
};

const NOC_TO_CODE2: Record<string, string> = {
  SRB:"rs", MKD:"mk", CRO:"hr", BIH:"ba", SLO:"si", MNE:"me",
  HUN:"hu", ROU:"ro", BUL:"bg", GRE:"gr", GER:"de", FRA:"fr",
  ITA:"it", ESP:"es", RUS:"ru", CHN:"cn", IND:"in", USA:"us",
  GBR:"gb", AUS:"au", JPN:"jp", KOR:"kr", AZE:"az", KAZ:"kz",
  UKR:"ua", POL:"pl", CZE:"cz", SVK:"sk", AUT:"at", SUI:"ch",
  NOR:"no", FIN:"fi", SWE:"se", DEN:"dk", BEL:"be", NED:"nl",
  POR:"pt", TUR:"tr", EGY:"eg", IRI:"ir", QAT:"qa", BRA:"br",
  ARG:"ar", CAN:"ca", MEX:"mx", RSA:"za",
};

function fold(s: string): string {
  return s.toLowerCase()
    .replace(/[šś]/g, "s").replace(/[čć]/g, "c")
    .replace(/ž/g, "z").replace(/đ/g, "dj")
    .replace(/á|à|ä/g, "a").replace(/é|è|ë/g, "e")
    .replace(/ó|ö|ő/g, "o").replace(/ú|ü|ű/g, "u")
    .replace(/ñ/g, "n");
}

const LEVEL_MAP: Record<string, string> = {
  olimpijsko:"olympic", olimpijski:"olympic", olimpijska:"olympic", olympic:"olympic",
  svetsko:"world", svetski:"world", svetska:"world", world:"world",
  kontinentalno:"continental", kontinentalni:"continental", continental:"continental",
  medjunarodno:"international", medjunarodni:"international",
  "medunarodno":"international", international:"international",
  drzavno:"national", drzavni:"national", national:"national",
  regionalno:"regional", regionalni:"regional", regional:"regional",
  klubsko:"club", klupsko:"club", klub:"club", club:"club",
};

const LEVEL_LABELS: Record<string, { sr: string; en: string }> = {
  olympic:       { sr: "Olimpijsko",    en: "Olympic" },
  world:         { sr: "Svetsko",       en: "World" },
  continental:   { sr: "Kontinentalno", en: "Continental" },
  international: { sr: "Međunarodno",   en: "International" },
  national:      { sr: "Državno",       en: "National" },
  regional:      { sr: "Regionalno",    en: "Regional" },
  club:          { sr: "Klupsko",       en: "Club" },
};

const DISC_CODES = new Set(["ARM","ARW","APM","APW","R3PM","R3PW","R3JM","R3JW","SPW","RFPM","FPM"]);

type DiscInfo = { sr: string; en: string; aparat: string; pol: "m" | "f" | null };
const DISC_LABELS: Record<string, DiscInfo> = {
  ARM:  { sr: "Vazdušna puška muški",    en: "Air Rifle Men",          aparat:"AR", pol:"m" },
  ARW:  { sr: "Vazdušna puška ženski",   en: "Air Rifle Women",        aparat:"AR", pol:"f" },
  APM:  { sr: "Vazdušni pištolj muški",  en: "Air Pistol Men",         aparat:"AP", pol:"m" },
  APW:  { sr: "Vazdušni pištolj ženski", en: "Air Pistol Women",       aparat:"AP", pol:"f" },
  R3PM: { sr: "MK puška muški",          en: "50m Rifle 3P Men",       aparat:"AR", pol:"m" },
  R3PW: { sr: "MK puška ženski",         en: "50m Rifle 3P Women",     aparat:"AR", pol:"f" },
  R3JM: { sr: "MK puška juniorski",      en: "50m Rifle 3P Junior Men",aparat:"AR", pol:"m" },
  R3JW: { sr: "MK puška juniork.",       en: "50m Rifle 3P Junior W.", aparat:"AR", pol:"f" },
  SPW:  { sr: "Sport pištolj ženski",    en: "25m Sport Pistol Women", aparat:"AP", pol:"f" },
  RFPM: { sr: "Slobodna puška muški",    en: "50m Rifle Prone Men",    aparat:"AR", pol:"m" },
  FPM:  { sr: "Slobodni pištolj muški",  en: "50m Free Pistol Men",    aparat:"AP", pol:"m" },
};

const APARAT_LABELS = {
  AR: { sr: "Puška",    en: "Rifle" },
  AP: { sr: "Pištolj",  en: "Pistol" },
};

const NOC_DISPLAY: Record<string, string> = {
  SRB:"Srbija",MKD:"Makedonija",CRO:"Hrvatska",BIH:"BiH",SLO:"Slovenija",
  MNE:"Crna Gora",HUN:"Mađarska",ROU:"Rumunija",BUL:"Bugarska",GRE:"Grčka",
  GER:"Nemačka",FRA:"Francuska",ITA:"Italija",ESP:"Španija",RUS:"Rusija",
  CHN:"Kina",IND:"Indija",USA:"SAD",GBR:"V. Britanija",AUS:"Australija",
  JPN:"Japan",KOR:"J. Koreja",AZE:"Azerbejdžan",KAZ:"Kazahstan",
  UKR:"Ukrajina",POL:"Poljska",CZE:"Češka",SVK:"Slovačka",AUT:"Austrija",
  SUI:"Švajcarska",NOR:"Norveška",FIN:"Finska",SWE:"Švedska",DEN:"Danska",
  BEL:"Belgija",NED:"Holandija",POR:"Portugal",TUR:"Turska",EGY:"Egipat",
  IRI:"Iran",QAT:"Katar",BRA:"Brazil",ARG:"Argentina",CAN:"Kanada",MEX:"Meksiko",
};

const COUNTRY_NOC: Record<string, [string, string]> = {
  "bosna i hercegovina":["BIH","BiH"], "severna makedonija":["MKD","S. Makedonija"],
  "north macedonia":["MKD","S. Makedonija"], "crna gora":["MNE","Crna Gora"],
  "great britain":["GBR","V. Britanija"], "united kingdom":["GBR","V. Britanija"],
  "velika britanija":["GBR","V. Britanija"], "juzna koreja":["KOR","J. Koreja"],
  "south korea":["KOR","J. Koreja"], "united states":["USA","SAD"],
  "sjedinjene":["USA","SAD"],
  srbija:["SRB","Srbija"], serbia:["SRB","Srbija"],
  makedonija:["MKD","Makedonija"], macedonia:["MKD","Makedonija"],
  hrvatska:["CRO","Hrvatska"], croatia:["CRO","Hrvatska"],
  bosna:["BIH","BiH"], bih:["BIH","BiH"], bosnia:["BIH","BiH"],
  slovenija:["SLO","Slovenija"], slovenia:["SLO","Slovenija"],
  madarska:["HUN","Mađarska"], madjarska:["HUN","Mađarska"], hungary:["HUN","Mađarska"],
  rumunija:["ROU","Rumunija"], romania:["ROU","Rumunija"],
  bugarska:["BUL","Bugarska"], bulgaria:["BUL","Bugarska"],
  grcka:["GRE","Grčka"], greece:["GRE","Grčka"],
  nemacka:["GER","Nemačka"], germany:["GER","Nemačka"], deutschland:["GER","Nemačka"],
  francuska:["FRA","Francuska"], france:["FRA","Francuska"],
  italija:["ITA","Italija"], italy:["ITA","Italija"],
  spanija:["ESP","Španija"], spain:["ESP","Španija"],
  rusija:["RUS","Rusija"], russia:["RUS","Rusija"],
  kina:["CHN","Kina"], china:["CHN","Kina"],
  indija:["IND","Indija"], india:["IND","Indija"],
  sad:["USA","SAD"], usa:["USA","SAD"],
  australija:["AUS","Australija"], australia:["AUS","Australija"],
  japan:["JPN","Japan"],
  azerbejdzan:["AZE","Azerbejdžan"], azerbaijan:["AZE","Azerbejdžan"],
  kazahstan:["KAZ","Kazahstan"], kazakhstan:["KAZ","Kazahstan"],
  ukrajina:["UKR","Ukrajina"], ukraine:["UKR","Ukrajina"],
  poljska:["POL","Poljska"], poland:["POL","Poljska"],
  ceska:["CZE","Češka"], czechia:["CZE","Češka"],
  slovacka:["SVK","Slovačka"], slovakia:["SVK","Slovačka"],
  austrija:["AUT","Austrija"], austria:["AUT","Austrija"],
  svajcarska:["SUI","Švajcarska"], switzerland:["SUI","Švajcarska"],
  norveska:["NOR","Norveška"], norway:["NOR","Norveška"],
  finska:["FIN","Finska"], finland:["FIN","Finska"],
  svedska:["SWE","Švedska"], sweden:["SWE","Švedska"],
  danska:["DEN","Danska"], denmark:["DEN","Danska"],
  belgija:["BEL","Belgija"], belgium:["BEL","Belgija"],
  holandija:["NED","Holandija"], netherlands:["NED","Holandija"],
  portugal:["POR","Portugal"],
  turska:["TUR","Turska"], turkey:["TUR","Turska"],
  iran:["IRI","Iran"],
  katar:["QAT","Katar"], qatar:["QAT","Katar"],
  egipat:["EGY","Egipat"], egypt:["EGY","Egipat"],
  brazil:["BRA","Brazil"],
  argentina:["ARG","Argentina"],
  kanada:["CAN","Kanada"], canada:["CAN","Kanada"],
};

function detectShortcuts(q: string, locale: string, scopedHref: (path: string) => string): Shortcut[] {
  if (q.length < 2) return [];
  const f = fold(q);
  const tokens = f.split(/\s+/).filter(Boolean);
  const upperTokens = q.toUpperCase().split(/\s+/).filter(Boolean);
  const isEn = locale === "en";
  const compsLabel = isEn ? "Competitions" : "Takmičenja";
  const shootersLabel = isEn ? "Shooters" : "Strelci";
  const shortcuts: Shortcut[] = [];

  // Year
  const yearMatch = q.match(/\b(20\d{2})\b/);
  const year = yearMatch?.[1] ?? null;

  // Level
  let level: string | null = null;
  for (const [kw, code] of Object.entries(LEVEL_MAP)) {
    if (tokens.includes(kw)) { level = code; break; }
  }

  // Discipline code (exact 3-5 letter uppercase)
  const discCode = upperTokens.find(t => DISC_CODES.has(t)) ?? null;

  // Apparatus
  const RIFLE_KW = ["puska","puske","puskom","rifle","karabin"];
  const PISTOL_KW = ["pistolj","pistoljom","pistolu","pistol"];
  let apparatus: "AR" | "AP" | null = null;
  if (tokens.some(t => RIFLE_KW.includes(t))) apparatus = "AR";
  else if (tokens.some(t => PISTOL_KW.includes(t))) apparatus = "AP";

  // Gender
  const MALE_KW = ["muski","muski","men","male","muskarci","muskaraca"];
  const FEMALE_KW = ["zenski","zenska","zene","women","female"];
  let gender: "m" | "f" | null = null;
  if (tokens.some(t => MALE_KW.includes(t))) gender = "m";
  else if (tokens.some(t => FEMALE_KW.includes(t))) gender = "f";

  // Distance tag
  let distTag: string | null = null;
  if (/\b10\s*m\b/i.test(q)) distTag = "10m";
  else if (/\b50\s*m\b/i.test(q)) distTag = "50m";
  else if (/\b25\s*m\b/i.test(q)) distTag = "25m";

  // Country — multi-word first (longest key first), then single NOC code
  let country: [string, string] | null = null;
  const sortedCountries = Object.entries(COUNTRY_NOC).sort((a, b) => b[0].length - a[0].length);
  for (const [kw, info] of sortedCountries) {
    const kwParts = kw.split(" ");
    const matched = kwParts.length > 1 ? f.includes(kw) : tokens.includes(kw);
    if (matched) { country = info; break; }
  }
  if (!country) {
    const nocToken = upperTokens.find(t => /^[A-Z]{3}$/.test(t) && NOC_DISPLAY[t]);
    if (nocToken) country = [nocToken, NOC_DISPLAY[nocToken]];
  }

  // ── Build shortcuts ──────────────────────────────────────────────────────────

  // Level + year (combined first if both present)
  if (level || year) {
    const ll = level ? (isEn ? LEVEL_LABELS[level]?.en : LEVEL_LABELS[level]?.sr) ?? level : null;
    if (level && year) {
      const p = new URLSearchParams(); p.set("level", level); p.set("year", year);
      shortcuts.push({ icon:"filter", label:`${compsLabel} · ${ll} · ${year}`, href: scopedHref(`/takmicenja?${p}`) });
    }
    const p2 = new URLSearchParams();
    if (year) p2.set("year", year);
    if (level) p2.set("level", level);
    if (!(level && year)) {
      shortcuts.push({ icon:"filter", label:[compsLabel, ll, year].filter(Boolean).join(" · "), href: scopedHref(`/takmicenja?${p2}`) });
    } else {
      const pL = new URLSearchParams(); pL.set("level", level);
      shortcuts.push({ icon:"filter", label:`${compsLabel} · ${ll}`, href: scopedHref(`/takmicenja?${pL}`) });
      const pY = new URLSearchParams(); pY.set("year", year);
      shortcuts.push({ icon:"filter", label:`${compsLabel} · ${year}`, href: scopedHref(`/takmicenja?${pY}`) });
    }
  }

  // Disc code → strelci
  if (discCode && DISC_LABELS[discCode]) {
    const dl = DISC_LABELS[discCode];
    const p = new URLSearchParams(); p.set("aparat", dl.aparat); if (dl.pol) p.set("pol", dl.pol);
    shortcuts.push({ icon:"person", label:`${shootersLabel} · ${isEn ? dl.en : dl.sr}`, href: scopedHref(`/strelci?${p}`) });
  }

  // Apparatus → strelci (not if a disc code already matched)
  if (apparatus && !discCode) {
    const al = APARAT_LABELS[apparatus];
    const base = new URLSearchParams(); base.set("aparat", apparatus);
    if (gender) {
      const p = new URLSearchParams(base); p.set("pol", gender);
      shortcuts.push({ icon:"person", label:`${shootersLabel} · ${isEn ? al.en : al.sr} ${gender === "m" ? (isEn ? "men" : "muški") : (isEn ? "women" : "ženski")}`, href: scopedHref(`/strelci?${p}`) });
    } else {
      shortcuts.push({ icon:"person", label:`${shootersLabel} · ${isEn ? al.en : al.sr} (${isEn ? "all" : "svi"})`, href: scopedHref(`/strelci?${base}`) });
      const pm = new URLSearchParams(base); pm.set("pol","m");
      shortcuts.push({ icon:"person", label:`${shootersLabel} · ${isEn ? al.en : al.sr} ${isEn ? "men" : "muški"}`, href: scopedHref(`/strelci?${pm}`) });
      const pf = new URLSearchParams(base); pf.set("pol","f");
      shortcuts.push({ icon:"person", label:`${shootersLabel} · ${isEn ? al.en : al.sr} ${isEn ? "women" : "ženski"}`, href: scopedHref(`/strelci?${pf}`) });
    }
  }

  // Distance tag
  if (distTag) {
    const p = new URLSearchParams(); p.set("tag", distTag);
    shortcuts.push({ icon:"filter", label:`${compsLabel} · ${distTag}`, href: scopedHref(`/takmicenja?${p}`) });
  }

  // Country
  if (country) {
    const [noc, display] = country;
    const code2 = NOC_TO_CODE2[noc];
    const ps = new URLSearchParams(); ps.set("zemlja", noc);
    shortcuts.push({ icon:"flag", label:`${shootersLabel} · ${display} (${noc})`, href: scopedHref(`/strelci?${ps}`), countryCode2: code2 });
    const pc = new URLSearchParams(); pc.set("location", display);
    shortcuts.push({ icon:"location", label:`${compsLabel} · ${display} (${isEn ? "location" : "lokacija"})`, href: scopedHref(`/takmicenja?${pc}`), countryCode2: code2 });
  }

  return shortcuts.slice(0, 7);
}

// ── Shortcut icons ────────────────────────────────────────────────────────────

function FilterIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden="true">
      <path d="M1 2h11M3 6h7M5.5 10h2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
    </svg>
  );
}

function PersonGroupIcon() {
  return (
    <svg width="14" height="13" viewBox="0 0 14 13" fill="none" aria-hidden="true">
      <circle cx="5.5" cy="4" r="2.3" stroke="currentColor" strokeWidth="1.3"/>
      <path d="M1 11c0-2.485 2.015-4.5 4.5-4.5S10 8.515 10 11" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
      <circle cx="10.5" cy="3.5" r="1.7" stroke="currentColor" strokeWidth="1.2"/>
      <path d="M13 10.5c0-1.657-1.12-3-2.5-3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
    </svg>
  );
}

function FlagIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden="true">
      <path d="M2 1v11M2 1h8.5L8 5h2.5L8 9H2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

function LocationIcon() {
  return (
    <svg width="12" height="13" viewBox="0 0 12 13" fill="none" aria-hidden="true">
      <path d="M6 1C3.79 1 2 2.79 2 5c0 3.25 4 7 4 7s4-3.75 4-7c0-2.21-1.79-4-4-4Z" stroke="currentColor" strokeWidth="1.3"/>
      <circle cx="6" cy="5" r="1.3" fill="currentColor"/>
    </svg>
  );
}

// ── Types ─────────────────────────────────────────────────────────────────────

export type SearchShooter = {
  id: number;
  firstName: string;
  lastName: string;
  clubName: string | null;
  avatarUrl: string | null;
};

export type SearchCompetition = {
  id: number;
  name: string;
  date: string;
  level: string;
};

type SearchResults = { shooters: SearchShooter[]; competitions: SearchCompetition[] };

const EMPTY_RESULTS: SearchResults = { shooters: [], competitions: [] };

// ── Sub-components ────────────────────────────────────────────────────────────

function ShooterAvatar({
  firstName,
  lastName,
  avatarUrl,
}: {
  firstName: string;
  lastName: string;
  avatarUrl: string | null;
}) {
  const initials = `${lastName[0] ?? ""}${firstName[0] ?? ""}`.toUpperCase();

  if (avatarUrl) {
    return (
      <Image
        src={avatarUrl}
        alt=""
        width={32}
        height={32}
        className="w-8 h-8 rounded-lg object-cover shrink-0"
      />
    );
  }

  return (
    <span
      className="w-8 h-8 rounded-lg shrink-0 flex items-center justify-center text-[0.65rem] font-bold text-white select-none"
      style={{ background: "var(--brand-primary)" }}
    >
      {initials}
    </span>
  );
}

function SearchIcon({ size = 16 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
    >
      <circle
        cx="7"
        cy="7"
        r="4.5"
        stroke="currentColor"
        strokeWidth="1.5"
        fill="none"
      />
      <path
        d="M11 11L14 14"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

function ArrowIcon() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 12 12"
      fill="none"
      aria-hidden="true"
      className="shrink-0 text-[var(--subtle)]"
    >
      <path
        d="M2.5 6h7M7 3.5L9.5 6L7 8.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function GlobalSearch() {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResults>(EMPTY_RESULTS);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState(false);
  const [retry, setRetry] = useState(0);
  const [activeIndex, setActiveIndex] = useState(0);
  const reducedMotion = useReducedMotion();
  const mounted = useSyncExternalStore(() => () => {}, () => true, () => false);
  const inputRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const lastFocusedElementRef = useRef<HTMLElement | null>(null);
  const router = useRouter();
  const scopedHref = useScopedHref();
  const locale = useLocale();
  const { scope } = useParams<{ scope?: string }>();
  const t = useTranslations("search");

  const openModal = useCallback(() => {
    lastFocusedElementRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setIsOpen(true);
    setQuery("");
    setResults(EMPTY_RESULTS);
    setIsSearching(false);
    setSearchError(false);
    setActiveIndex(0);
  }, []);

  const closeModal = useCallback(() => setIsOpen(false), []);

  // ⌘K / Ctrl+K global shortcut
  useEffect(() => {
    function onGlobalKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        if (isOpen) closeModal();
        else openModal();
      }
      if (e.key === "Escape") closeModal();
    }
    document.addEventListener("keydown", onGlobalKey);
    return () => document.removeEventListener("keydown", onGlobalKey);
  }, [isOpen, closeModal, openModal]);

  // External trigger (mobile drawer, etc.)
  useEffect(() => {
    function handler() { openModal(); }
    document.addEventListener("global-search:open", handler);
    return () => document.removeEventListener("global-search:open", handler);
  }, [openModal]);

  // Focus input on open
  useEffect(() => {
    if (isOpen) {
      const t = setTimeout(() => inputRef.current?.focus(), 60);
      return () => clearTimeout(t);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) {
      lastFocusedElementRef.current?.focus();
      lastFocusedElementRef.current = null;
      return;
    }

    function trapFocus(event: KeyboardEvent) {
      if (event.key !== "Tab") return;
      const items = [...(dialogRef.current?.querySelectorAll<HTMLElement>('input, button:not([disabled]), a[href]') ?? [])];
      if (!items.length) return;
      const first = items[0];
      const last = items.at(-1)!;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", trapFocus);
    return () => document.removeEventListener("keydown", trapFocus);
  }, [isOpen]);

  // Scroll lock
  useEffect(() => {
    document.body.style.overflow = isOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [isOpen]);

  const q = query.trim();

  useEffect(() => {
    if (q.length < 2) return;

    const controller = new AbortController();
    const timeout = setTimeout(() => {
      fetch(`/api/search?q=${encodeURIComponent(q)}&scope=${scope ?? "srb"}&locale=${locale}`, {
        signal: controller.signal,
      })
        .then((response) => {
          if (!response.ok) throw new Error("Search request failed");
          return response.json();
        })
        .then((data) => setResults(data))
        .catch(() => { if (!controller.signal.aborted) setSearchError(true); })
        .finally(() => { if (!controller.signal.aborted) setIsSearching(false); });
    }, 150);

    return () => {
      controller.abort();
      clearTimeout(timeout);
    };
  }, [q, scope, locale, retry]);

  const filteredShooters = results.shooters;
  const filteredComps = results.competitions;
  const shortcuts = q.length >= 2 ? detectShortcuts(q, locale, scopedHref) : [];

  const total = shortcuts.length + filteredShooters.length + filteredComps.length;

  // Keyboard nav within modal
  function onInputKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (total > 0) setActiveIndex((v) => Math.max(0, Math.min(v + 1, total - 1)));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (total > 0) setActiveIndex((v) => Math.max(0, v - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (total === 0) return;
      if (activeIndex < shortcuts.length) {
        router.push(shortcuts[activeIndex].href);
        closeModal(); return;
      }
      const si = activeIndex - shortcuts.length;
      const shooter = filteredShooters[si];
      if (shooter) {
        router.push(scopedHref(`/strelci/${shooter.id}`));
      } else {
        const c = filteredComps[si - filteredShooters.length];
        if (c) router.push(scopedHref(`/takmicenja/${c.id}`));
      }
      closeModal();
    }
  }

  // ── Modal JSX ─────────────────────────────────────────────────────────────

  const modal = (
    <motion.div
      key="global-search-modal"
      className="fixed inset-0 z-[var(--z-modal)] flex items-start justify-center px-4"
      style={{ paddingTop: "12vh", background: "oklch(0 0 0 / 0.45)", backdropFilter: "blur(3px)" }}
      initial={reducedMotion ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={reducedMotion ? { opacity: 1 } : { opacity: 0, transition: { duration: 0.3, ease: [0.22, 1, 0.36, 1] } }}
      transition={{ duration: reducedMotion ? 0 : 0.3, ease: [0.22, 1, 0.36, 1] }}
      onClick={(e) => { if (e.target === e.currentTarget) closeModal(); }}
      role="dialog"
      aria-modal="true"
      aria-label={t("ariaLabel")}
    >
      <motion.div
        ref={dialogRef}
        className="w-full max-w-xl rounded-xl border border-[var(--border)] overflow-hidden"
        style={{ background: "var(--bg)" }}
        initial={reducedMotion ? false : { opacity: 0, y: -28, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={reducedMotion ? { opacity: 1 } : {
          opacity: [1, 1, 0],
          y: -28,
          scale: 0.98,
          transition: {
            duration: 0.36,
            ease: [0.22, 1, 0.36, 1],
            opacity: { times: [0, 0.55, 1] },
          },
        }}
        transition={{ duration: reducedMotion ? 0 : 0.36, ease: [0.22, 1, 0.36, 1] }}
      >
        {/* Input row */}
        <div className="flex items-center gap-3 px-4 border-b border-[var(--border)]">
          <span className="shrink-0 text-[var(--muted)]">
            <SearchIcon size={15} />
          </span>
          <input
            ref={inputRef}
            type="search"
            name="q"
            placeholder={t("fullPlaceholder")}
            value={query}
            onChange={(e) => {
              const nextQuery = e.target.value;
              setQuery(nextQuery);
              setResults(EMPTY_RESULTS);
              setIsSearching(nextQuery.trim().length >= 2);
              setSearchError(false);
              setActiveIndex(0);
            }}
            onKeyDown={onInputKeyDown}
            className="flex-1 py-[1.1rem] text-sm text-[var(--ink)] placeholder:text-[var(--subtle)] bg-transparent outline-none focus:outline-none focus:ring-0 [&:focus-visible]:outline-none [&::-webkit-search-cancel-button]:hidden [&::-webkit-search-decoration]:hidden"
            autoComplete="off"
            spellCheck={false}
          />
          {query && (
            <button
              onClick={() => { setQuery(""); setActiveIndex(0); }}
              className="shrink-0 text-xs text-[var(--subtle)] hover:text-[var(--muted)] transition-colors px-1 py-0.5"
            >
              {t("clear")}
            </button>
          )}
          <button
            type="button"
            onClick={closeModal}
            aria-label={t("navEsc")}
            className="shrink-0 min-h-11 px-2 font-[family-name:var(--font-jetbrains-mono)] text-[0.6rem] rounded bg-[var(--surface-2)] border border-[var(--border)] text-[var(--subtle)] hover:text-[var(--muted)] transition-colors select-none"
          >
            ESC
          </button>
        </div>

        {/* Results */}
        <div className="overflow-y-auto" style={{ maxHeight: "min(58vh, 420px)" }}>
          {!q ? (
            <div className="px-4 py-10 text-center">
              <p className="text-sm text-[var(--subtle)]">
                {t("emptyHint")}
              </p>
            </div>
          ) : isSearching ? (
            <div className="px-4 py-10 text-center">
              <p className="text-sm text-[var(--muted)]">Pretraživanje…</p>
            </div>
          ) : searchError ? (
            <div className="px-4 py-10 text-center">
              <p className="text-sm text-[var(--muted)]">{t("error")}</p>
              <button onClick={() => { setSearchError(false); setIsSearching(true); setRetry((v) => v + 1); }} className="mt-3 min-h-11 px-3 text-sm font-semibold text-[var(--brand-primary)] hover:underline">
                {t("retry")}
              </button>
            </div>
          ) : total === 0 ? (
            <div className="px-4 py-10 text-center">
              <p className="text-sm text-[var(--muted)]">
                {t("noResults", { query })}
              </p>
            </div>
          ) : (
            <>
              {/* Shortcuts section */}
              {shortcuts.length > 0 && (
                <div className={filteredShooters.length > 0 || filteredComps.length > 0 ? "border-b border-[var(--border)]" : ""}>
                  <div className="px-4 pt-3 pb-1">
                    <span className="text-[0.6rem] font-bold uppercase tracking-widest text-[var(--subtle)]">
                      {locale === "en" ? "Filters" : "Prečice"}
                    </span>
                  </div>
                  {shortcuts.map((sc, i) => {
                    const active = activeIndex === i;
                    return (
                      <Link
                        key={sc.href}
                        href={sc.href}
                        onClick={closeModal}
                        onMouseEnter={() => setActiveIndex(i)}
                        className="flex items-center gap-3 px-4 py-2.5 transition-colors"
                        style={{ background: active ? "var(--surface-2)" : "transparent" }}
                      >
                        <span
                          className="shrink-0 w-8 h-8 rounded-md flex items-center justify-center overflow-hidden"
                          style={{ background: "var(--surface-2)", color: "var(--brand-primary)" }}
                          aria-hidden="true"
                        >
                          {sc.countryCode2
                            ? <span className={`fi fi-${sc.countryCode2}`} style={{ fontSize: 20, borderRadius: 2 }} />
                            : sc.icon === "filter"   ? <FilterIcon />
                            : sc.icon === "person"   ? <PersonGroupIcon />
                            : sc.icon === "flag"     ? <FlagIcon />
                            : <LocationIcon />}
                        </span>
                        <span className="flex-1 min-w-0 text-sm font-medium text-[var(--ink)] truncate">
                          {sc.label}
                        </span>
                        {active && <ArrowIcon />}
                      </Link>
                    );
                  })}
                </div>
              )}

              {/* Shooters section */}
              {filteredShooters.length > 0 && (
                <div>
                  <div className="px-4 pt-3 pb-1">
                    <span className="text-[0.6rem] font-bold uppercase tracking-widest text-[var(--subtle)]">
                      {t("shootersSection")}
                    </span>
                  </div>
                  {filteredShooters.map((s, i) => {
                    const globalIdx = shortcuts.length + i;
                    const active = activeIndex === globalIdx;
                    return (
                      <Link
                        key={s.id}
                        href={scopedHref(`/strelci/${s.id}`)}
                        onClick={closeModal}
                        onMouseEnter={() => setActiveIndex(globalIdx)}
                        className="flex items-center gap-3 px-4 py-2.5 transition-colors"
                        style={{ background: active ? "var(--surface-2)" : "transparent" }}
                      >
                        <ShooterAvatar
                          firstName={s.firstName}
                          lastName={s.lastName}
                          avatarUrl={s.avatarUrl}
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-[var(--ink)] truncate">
                            {s.lastName} {s.firstName}
                          </p>
                          {s.clubName && (
                            <p className="text-xs text-[var(--muted)] truncate">
                              {s.clubName}
                            </p>
                          )}
                        </div>
                        {active && <ArrowIcon />}
                      </Link>
                    );
                  })}
                </div>
              )}

              {/* Competitions section */}
              {filteredComps.length > 0 && (
                <div
                  className={filteredShooters.length > 0 ? "border-t border-[var(--border)]" : ""}
                >
                  <div className="px-4 pt-3 pb-1">
                    <span className="text-[0.6rem] font-bold uppercase tracking-widest text-[var(--subtle)]">
                      {t("competitionsSection")}
                    </span>
                  </div>
                  {filteredComps.map((c, i) => {
                    const globalIdx = shortcuts.length + filteredShooters.length + i;
                    const active = activeIndex === globalIdx;
                    const levelStyle = LEVEL_STYLE[c.level] ?? LEVEL_STYLE.club;
                    const levelLabel = LEVEL_LABEL[c.level] ?? c.level;

                    return (
                      <Link
                        key={c.id}
                        href={scopedHref(`/takmicenja/${c.id}`)}
                        onClick={closeModal}
                        onMouseEnter={() => setActiveIndex(globalIdx)}
                        className="flex items-center gap-3 px-4 py-2.5 transition-colors"
                        style={{ background: active ? "var(--surface-2)" : "transparent" }}
                      >
                        {/* Calendar icon tile */}
                        <span
                          className="shrink-0 w-8 h-8 rounded-md flex items-center justify-center"
                          style={{ background: "var(--surface-2)" }}
                          aria-hidden="true"
                        >
                          <svg
                            width="14"
                            height="14"
                            viewBox="0 0 14 14"
                            fill="none"
                            className="text-[var(--muted)]"
                          >
                            <rect
                              x="1"
                              y="2"
                              width="12"
                              height="11"
                              rx="1.5"
                              stroke="currentColor"
                              strokeWidth="1.3"
                            />
                            <path
                              d="M1 6h12M4.5 1v2M9.5 1v2"
                              stroke="currentColor"
                              strokeWidth="1.3"
                              strokeLinecap="round"
                            />
                          </svg>
                        </span>

                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-[var(--ink)] truncate">
                            {c.name}
                          </p>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span
                              className="text-[0.6rem] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded font-[family-name:var(--font-barlow-condensed)]"
                              style={levelStyle}
                            >
                              {levelLabel}
                            </span>
                            <span className="text-xs text-[var(--muted)] font-[family-name:var(--font-jetbrains-mono)]">
                              {c.date}
                            </span>
                          </div>
                        </div>
                        {active && <ArrowIcon />}
                      </Link>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer hints */}
        {total > 0 && (
          <div className="hidden border-t border-[var(--border)] px-4 py-2 sm:flex items-center gap-4 text-[0.6rem] text-[var(--subtle)] font-[family-name:var(--font-jetbrains-mono)] select-none">
            <span className="flex items-center gap-1">
              <kbd className="px-1 py-0.5 rounded border border-[var(--border)] bg-[var(--surface-2)]">↑↓</kbd>
              {t("navArrows")}
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1 py-0.5 rounded border border-[var(--border)] bg-[var(--surface-2)]">↵</kbd>
              {t("navEnter")}
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1 py-0.5 rounded border border-[var(--border)] bg-[var(--surface-2)]">esc</kbd>
              {t("navEsc")}
            </span>
          </div>
        )}
      </motion.div>
    </motion.div>
  );

  return (
    <>
      {/* Desktop trigger — pill with ⌘K hint */}
      <button
        onClick={openModal}
        className="hidden lg:flex items-center gap-2 px-3 py-1.5 rounded-lg border border-[var(--border)] bg-[var(--surface-2)] text-xs text-[var(--muted)] hover:border-[var(--border-strong)] hover:text-[var(--ink)] transition-all w-52 cursor-pointer"
      >
        <span className="text-[var(--subtle)] shrink-0">
          <SearchIcon size={13} />
        </span>
        <span className="flex-1 text-left">{t("desktopPlaceholder")}</span>
        <kbd className="font-[family-name:var(--font-jetbrains-mono)] text-[0.6rem] px-1.5 py-0.5 rounded bg-[var(--surface)] border border-[var(--border)] text-[var(--subtle)] shrink-0 select-none">
          ⌘K
        </kbd>
      </button>

      {/* Mobile trigger — icon only */}
      <button
        onClick={openModal}
        className="ml-auto flex h-11 w-11 items-center justify-center rounded-md text-[var(--muted)] transition-colors hover:bg-[var(--surface-2)] hover:text-[var(--ink)] lg:hidden lg:ml-0"
        aria-label={t("ariaLabel")}
      >
        <SearchIcon size={16} />
      </button>

      {/* Portal modal — renders in body, outside header stacking context */}
      {mounted && createPortal(
        <AnimatePresence>{isOpen && modal}</AnimatePresence>,
        document.body,
      )}
    </>
  );
}
