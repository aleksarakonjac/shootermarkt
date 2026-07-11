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
