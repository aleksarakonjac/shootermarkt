export function formatDateSr(dateInput: string | Date | null | undefined): string {
  if (!dateInput) return "";
  if (typeof dateInput === 'string') {
    const onlyDateMatch = dateInput.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (onlyDateMatch) {
      return `${onlyDateMatch[3]}.${onlyDateMatch[2]}.${onlyDateMatch[1]}.`;
    }
  }
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return String(dateInput);
  return `${d.getDate().toString().padStart(2, '0')}.${(d.getMonth() + 1).toString().padStart(2, '0')}.${d.getFullYear()}.`;
}

export function formatDateRangeSr(start: string | Date | null | undefined, end?: string | Date | null): string {
  if (!start) return "";
  const s = formatDateSr(start);
  if (!end) return s;
  const e = formatDateSr(end);
  if (!e || s === e) return s;
  return `${s} \u2013 ${e}`;
}

const SHORT_MONTHS_SR = ["jan","feb","mar","apr","maj","jun","jul","avg","sep","okt","nov","dec"];
const SHORT_MONTHS_EN = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

// Kratak opseg za liste i kalendar: "15. okt", "15–19. okt", "28. sep – 3. okt".
export function formatShortDateRange(date: string, dateEnd?: string | null, locale?: string): string {
  const M = locale === "en" ? SHORT_MONTHS_EN : SHORT_MONTHS_SR;
  const d = new Date(date + "T00:00:00");
  const s = `${d.getDate()}. ${M[d.getMonth()]}`;
  if (!dateEnd || dateEnd === date) return s;
  const de = new Date(dateEnd + "T00:00:00");
  return de.getMonth() === d.getMonth()
    ? `${d.getDate()}\u2013${de.getDate()}. ${M[d.getMonth()]}`
    : `${s} \u2013 ${de.getDate()}. ${M[de.getMonth()]}`;
}
