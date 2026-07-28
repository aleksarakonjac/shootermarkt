"use client";

import { useState, useTransition, useRef, useEffect } from "react";
import { useTranslations } from "next-intl";
import { Send, CheckCircle, AlertCircle, Loader2, ChevronDown, Check } from "lucide-react";
import { sendContactMessage, type ContactState } from "./actions";

interface FieldErrors {
  name?: string;
  email?: string;
  topic?: string;
  message?: string;
}

function isValidEmail(e: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
}

function validate(
  field: keyof FieldErrors,
  value: string,
  t: (k: string) => string
): string | undefined {
  if (field === "name" && !value.trim()) return t("form.nameError");
  if (field === "email") {
    if (!value.trim()) return t("form.emailError");
    if (!isValidEmail(value)) return t("form.emailError");
  }
  if (field === "topic" && !value) return t("form.topicPlaceholder");
  if (field === "message" && value.trim().length < 20) return t("form.messageError");
  return undefined;
}

const TOPIC_KEYS = ["general", "error", "suggestion", "cooperation"] as const;

const inputBase =
  "w-full rounded-lg border border-[var(--border-strong)] bg-[var(--bg)] text-[var(--ink)] text-sm px-3 py-2.5 " +
  "placeholder:text-[var(--subtle)] " +
  "focus:outline-none focus:border-[var(--brand-primary)] focus:ring-2 focus:ring-[var(--brand-primary)]/20 " +
  "transition-colors";

const inputError = "border-red-500 focus:border-red-500 focus:ring-red-500/20";

// ── Custom topic dropdown ─────────────────────────────────────────────────────

interface TopicSelectProps {
  value: string;
  onChange: (v: string) => void;
  onBlur: () => void;
  options: { value: string; label: string }[];
  placeholder: string;
  hasError?: boolean;
  id: string;
  ariaDescribedBy?: string;
}

function TopicSelect({
  value, onChange, onBlur, options, placeholder, hasError, id, ariaDescribedBy,
}: TopicSelectProps) {
  const [open, setOpen] = useState(false);
  const [focusedIdx, setFocusedIdx] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        onBlur();
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open, onBlur]);

  const selectedLabel = options.find((o) => o.value === value)?.label;

  const openDropdown = () => {
    setFocusedIdx(Math.max(0, options.findIndex((o) => o.value === value)));
    setOpen(true);
  };

  const select = (v: string) => {
    onChange(v);
    setOpen(false);
    onBlur();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      if (open) select(options[focusedIdx]?.value ?? value);
      else openDropdown();
    } else if (e.key === "Escape") {
      setOpen(false);
      onBlur();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      if (!open) { openDropdown(); return; }
      setFocusedIdx((i) => Math.min(i + 1, options.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setFocusedIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === "Tab") {
      setOpen(false);
      onBlur();
    }
  };

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        id={id}
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={`${id}-listbox`}
        aria-describedby={ariaDescribedBy}
        aria-invalid={hasError}
        onClick={() => (open ? (setOpen(false), onBlur()) : openDropdown())}
        onKeyDown={handleKeyDown}
        className={[
          inputBase,
          hasError ? inputError : "",
          "flex items-center justify-between cursor-pointer text-left",
        ].join(" ")}
      >
        <span className={selectedLabel ? "text-[var(--ink)]" : "text-[var(--subtle)]"}>
          {selectedLabel ?? placeholder}
        </span>
        <ChevronDown
          className={`w-4 h-4 shrink-0 text-[var(--muted)] transition-transform duration-150 ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <ul
          id={`${id}-listbox`}
          role="listbox"
          aria-label={placeholder}
          className="absolute top-full left-0 right-0 mt-1 bg-[var(--bg)] border border-[var(--border)] rounded-lg shadow-lg z-[var(--z-dropdown)] py-1 overflow-hidden"
          style={{ boxShadow: "0 8px 24px rgba(0,0,0,0.10)" }}
        >
          {options.map((opt, i) => {
            const isSelected = opt.value === value;
            const isFocused = i === focusedIdx;
            return (
              <li
                key={opt.value}
                role="option"
                aria-selected={isSelected}
                onMouseEnter={() => setFocusedIdx(i)}
                onMouseDown={(e) => {
                  e.preventDefault();
                  select(opt.value);
                }}
                className={[
                  "flex items-center justify-between px-3 py-2.5 text-sm cursor-pointer transition-colors select-none",
                  isFocused ? "bg-[var(--surface)]" : "hover:bg-[var(--surface)]",
                  isSelected ? "font-semibold text-[var(--ink)]" : "text-[var(--ink)]",
                ].join(" ")}
              >
                {opt.label}
                {isSelected && (
                  <Check className="w-3.5 h-3.5 text-[var(--brand-primary)] shrink-0" />
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

// ── Form ─────────────────────────────────────────────────────────────────────

export function KontaktForm() {
  const t = useTranslations("contact");
  const [isPending, startTransition] = useTransition();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [topic, setTopic] = useState("");
  const [message, setMessage] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [state, setState] = useState<ContactState>({ status: "idle" });

  const topicOptions = TOPIC_KEYS.map((k) => ({
    value: t(`form.topics.${k}`),
    label: t(`form.topics.${k}`),
  }));

  const blurField = (field: keyof FieldErrors, value: string) => {
    const err = validate(field, value, t);
    setErrors((e) => ({ ...e, [field]: err }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors: FieldErrors = {
      name: validate("name", name, t),
      email: validate("email", email, t),
      topic: validate("topic", topic, t),
      message: validate("message", message, t),
    };
    setErrors(newErrors);
    if (Object.values(newErrors).some(Boolean)) return;

    startTransition(async () => {
      const result = await sendContactMessage({ name, email, topic, message });
      setState(result);
    });
  };

  if (state.status === "success") {
    return (
      <div className="flex flex-col items-center gap-4 py-10 text-center">
        <span className="flex items-center justify-center w-14 h-14 rounded-full bg-[var(--success)]/10">
          <CheckCircle className="w-7 h-7 text-[var(--success)]" strokeWidth={1.75} />
        </span>
        <div>
          <p className="font-[family-name:var(--font-barlow-condensed)] font-bold text-xl uppercase tracking-tight text-[var(--ink)]">
            {t("form.successTitle")}
          </p>
          <p className="mt-1 text-sm text-[var(--muted)]">{t("form.successText")}</p>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-5">

      {/* Name + Email */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="cf-name" className="text-xs font-semibold text-[var(--muted)] uppercase tracking-wider">
            {t("form.name")} <span className="text-[var(--brand-primary)]">*</span>
          </label>
          <input
            id="cf-name"
            type="text"
            autoComplete="name"
            value={name}
            onChange={(e) => { setName(e.target.value); if (errors.name) setErrors((er) => ({ ...er, name: undefined })); }}
            onBlur={() => blurField("name", name)}
            className={`${inputBase} ${errors.name ? inputError : ""}`}
            aria-describedby={errors.name ? "cf-name-err" : undefined}
            aria-invalid={!!errors.name}
          />
          {errors.name && (
            <p id="cf-name-err" className="flex items-center gap-1 text-xs text-red-600" role="alert">
              <AlertCircle className="w-3 h-3 shrink-0" />{errors.name}
            </p>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="cf-email" className="text-xs font-semibold text-[var(--muted)] uppercase tracking-wider">
            {t("form.email")} <span className="text-[var(--brand-primary)]">*</span>
          </label>
          <input
            id="cf-email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => { setEmail(e.target.value); if (errors.email) setErrors((er) => ({ ...er, email: undefined })); }}
            onBlur={() => blurField("email", email)}
            className={`${inputBase} ${errors.email ? inputError : ""}`}
            aria-describedby={errors.email ? "cf-email-err" : undefined}
            aria-invalid={!!errors.email}
          />
          {errors.email && (
            <p id="cf-email-err" className="flex items-center gap-1 text-xs text-red-600" role="alert">
              <AlertCircle className="w-3 h-3 shrink-0" />{errors.email}
            </p>
          )}
        </div>
      </div>

      {/* Topic — custom dropdown */}
      <div className="flex flex-col gap-1.5">
        <label htmlFor="cf-topic" className="text-xs font-semibold text-[var(--muted)] uppercase tracking-wider">
          {t("form.topic")} <span className="text-[var(--brand-primary)]">*</span>
        </label>
        <TopicSelect
          id="cf-topic"
          value={topic}
          onChange={(v) => { setTopic(v); if (errors.topic) setErrors((er) => ({ ...er, topic: undefined })); }}
          onBlur={() => blurField("topic", topic)}
          options={topicOptions}
          placeholder={t("form.topicPlaceholder")}
          hasError={!!errors.topic}
          ariaDescribedBy={errors.topic ? "cf-topic-err" : undefined}
        />
        {errors.topic && (
          <p id="cf-topic-err" className="flex items-center gap-1 text-xs text-red-600" role="alert">
            <AlertCircle className="w-3 h-3 shrink-0" />{errors.topic}
          </p>
        )}
      </div>

      {/* Message */}
      <div className="flex flex-col gap-1.5">
        <label htmlFor="cf-message" className="text-xs font-semibold text-[var(--muted)] uppercase tracking-wider">
          {t("form.message")} <span className="text-[var(--brand-primary)]">*</span>
        </label>
        <textarea
          id="cf-message"
          rows={5}
          value={message}
          placeholder={t("form.messagePlaceholder")}
          onChange={(e) => { setMessage(e.target.value); if (errors.message) setErrors((er) => ({ ...er, message: undefined })); }}
          onBlur={() => blurField("message", message)}
          className={`${inputBase} resize-y min-h-[120px] ${errors.message ? inputError : ""}`}
          aria-describedby={errors.message ? "cf-message-err" : undefined}
          aria-invalid={!!errors.message}
        />
        <div className="flex items-center justify-between">
          {errors.message ? (
            <p id="cf-message-err" className="flex items-center gap-1 text-xs text-red-600" role="alert">
              <AlertCircle className="w-3 h-3 shrink-0" />{errors.message}
            </p>
          ) : <span />}
          <span className={`text-[10px] tabular-nums ${message.length < 20 ? "text-[var(--subtle)]" : "text-[var(--success)]"}`}>
            {message.length}/20
          </span>
        </div>
      </div>

      {/* Global error */}
      {state.status === "error" && (
        <div className="flex items-start gap-2.5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
          <span>{state.message || t("form.errorGlobal")}</span>
        </div>
      )}

      {/* Submit */}
      <button
        type="submit"
        disabled={isPending}
        className="flex items-center justify-center gap-2 w-full rounded-lg bg-[var(--brand-primary)] hover:bg-[var(--brand-primary-hover)] disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold text-sm py-3 px-6 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-primary)] focus-visible:ring-offset-2"
      >
        {isPending ? (
          <><Loader2 className="w-4 h-4 animate-spin" />{t("form.submitting")}</>
        ) : (
          <><Send className="w-4 h-4" />{t("form.submit")}</>
        )}
      </button>
    </form>
  );
}
