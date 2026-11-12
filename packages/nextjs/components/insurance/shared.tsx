import type { ButtonHTMLAttributes, ReactNode } from "react";
import { ArrowTrendingUpIcon, ExclamationCircleIcon } from "@heroicons/react/24/outline";

export type PolicyData = {
  flightNumber: string;
  departureDate: bigint;
  coverageStart: bigint;
  coverageEnd: bigint;
  coverageAmount: bigint;
  premium: bigint;
  riskFee: bigint;
  refundableAmount: bigint;
  status: number;
};

export const USDC_DECIMALS = 6;
export const inputClassName =
  "input input-bordered h-11 w-full rounded-lg border-white/10 bg-[#0b0f12] text-sm text-[#f2f6f4] outline-none transition focus:border-[#87f5d6]/60 focus:ring-2 focus:ring-[#87f5d6]/10";
export const labelClassName =
  "mb-2 flex items-center justify-between text-[11px] font-semibold tracking-[0.08em] text-[#7f8d91]";

export const formatUsdc = (value?: bigint, maximumFractionDigits = 2) => {
  if (value === undefined) return "-";
  const numericValue = Number(value) / 10 ** USDC_DECIMALS;
  return new Intl.NumberFormat("zh-CN", {
    minimumFractionDigits: 0,
    maximumFractionDigits,
  }).format(numericValue);
};

export const formatNumber = (value: number, maximumFractionDigits = 0) =>
  new Intl.NumberFormat("zh-CN", { maximumFractionDigits }).format(value);

export const formatDateTime = (value?: bigint) => {
  if (!value) return "-";
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(Number(value) * 1000));
};

export const formatDate = (value?: bigint) => {
  if (!value) return "-";
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(Number(value) * 1000));
};

export const toUnixTimestamp = (value: string) => {
  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) ? BigInt(Math.floor(timestamp / 1000)) : undefined;
};

export const toDateTimeLocal = (date: Date) => {
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60_000).toISOString().slice(0, 16);
};

export const shortAddress = (address?: string) => (address ? `${address.slice(0, 6)}...${address.slice(-4)}` : "-");

export const percentage = (part?: bigint, total?: bigint) => {
  if (!part || !total || total === 0n) return 0;
  return Math.min(100, Math.max(0, Number((part * 10_000n) / total) / 100));
};

export const policyStatusLabel = (status: number) => {
  if (status === 1) return "有效";
  if (status === 2) return "已理赔";
  if (status === 3) return "已到期";
  return "未知";
};

export function ConsolePanel({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`rounded-lg border border-white/[0.08] bg-[#0d1114] ${className}`}>{children}</section>;
}

export function SectionHeading({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        {eyebrow && <p className="m-0 text-[10px] font-semibold tracking-[0.12em] text-[#87f5d6]">{eyebrow}</p>}
        <h2 className="mb-0 mt-1 text-lg font-semibold tracking-normal text-[#f3f7f5]">{title}</h2>
        {description && <p className="mb-0 mt-2 max-w-2xl text-sm leading-6 text-[#839095]">{description}</p>}
      </div>
      {action}
    </div>
  );
}

export function MetricCard({
  label,
  value,
  unit,
  hint,
  icon,
  tone = "default",
  action,
}: {
  label: string;
  value: string;
  unit?: string;
  hint: string;
  icon?: ReactNode;
  tone?: "default" | "accent" | "warning";
  action?: ReactNode;
}) {
  const iconTone =
    tone === "accent"
      ? "bg-[#87f5d6]/10 text-[#87f5d6] ring-[#87f5d6]/15"
      : tone === "warning"
        ? "bg-[#f4c66a]/10 text-[#f4c66a] ring-[#f4c66a]/15"
        : "bg-white/[0.04] text-[#a8b4b6] ring-white/[0.06]";

  return (
    <div className="min-h-[134px] rounded-lg border border-white/[0.07] bg-[#0d1114] p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <p className="m-0 text-xs font-medium text-[#839095]">{label}</p>
        {icon && <span className={`grid h-8 w-8 place-items-center rounded-lg ring-1 ${iconTone}`}>{icon}</span>}
      </div>
      <div className="mt-4 flex items-baseline gap-1.5 overflow-hidden">
        <span className="truncate font-mono text-[clamp(1.35rem,2.3vw,1.9rem)] font-medium tracking-normal text-[#f2f6f4]">
          {value}
        </span>
        {unit && <span className="shrink-0 text-[11px] font-semibold text-[#667579]">{unit}</span>}
      </div>
      <p className="mb-0 mt-2 break-words text-[11px] leading-4 text-[#657276]">{hint}</p>
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}

type ConsoleButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  busy?: boolean;
  icon?: ReactNode;
};

export function ConsoleButton({
  children,
  variant = "secondary",
  busy = false,
  icon,
  className = "",
  disabled,
  ...props
}: ConsoleButtonProps) {
  const variants = {
    primary:
      "border-[#87f5d6] bg-[#87f5d6] text-[#07110e] hover:border-[#a3ffe7] hover:bg-[#a3ffe7] disabled:border-[#54625f] disabled:bg-[#54625f]",
    secondary:
      "border-white/10 bg-white/[0.035] text-[#dce5e2] hover:border-white/20 hover:bg-white/[0.065] disabled:text-[#596568]",
    ghost: "border-transparent bg-transparent text-[#9eaaad] hover:bg-white/[0.05] hover:text-white",
    danger: "border-[#f07878]/25 bg-[#f07878]/10 text-[#ff9c9c] hover:border-[#f07878]/40 hover:bg-[#f07878]/15",
  };

  return (
    <button
      type={props.type ?? "button"}
      className={`btn h-10 min-h-0 rounded-lg border px-4 text-xs font-semibold normal-case tracking-[0.01em] shadow-none disabled:cursor-not-allowed ${variants[variant]} ${className}`}
      disabled={disabled || busy}
      {...props}
    >
      {busy ? <span className="loading loading-spinner loading-xs" /> : icon}
      {children}
    </button>
  );
}

export function StatusChip({
  label,
  tone = "neutral",
}: {
  label: string;
  tone?: "neutral" | "success" | "warning" | "danger";
}) {
  const tones = {
    neutral: "border-white/10 bg-white/[0.04] text-[#9aa7aa]",
    success: "border-[#87f5d6]/20 bg-[#87f5d6]/10 text-[#87f5d6]",
    warning: "border-[#f4c66a]/20 bg-[#f4c66a]/10 text-[#f4c66a]",
    danger: "border-[#ff8a8a]/20 bg-[#ff8a8a]/10 text-[#ff9f9f]",
  };

  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-semibold ${tones[tone]}`}
    >
      {label}
    </span>
  );
}

export function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div className="grid min-h-44 place-items-center rounded-lg border border-dashed border-white/10 bg-white/[0.015] px-6 py-10 text-center">
      <div>
        <span className="mx-auto grid h-10 w-10 place-items-center rounded-full border border-white/10 bg-white/[0.03] text-[#7e8c90]">
          <ArrowTrendingUpIcon className="h-5 w-5" />
        </span>
        <p className="mb-1 mt-4 text-sm font-medium text-[#d7e0de]">{title}</p>
        <p className="m-0 text-xs leading-5 text-[#6f7c80]">{description}</p>
      </div>
    </div>
  );
}

export function InlineNotice({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "warning" | "danger";
}) {
  const tones = {
    neutral: "border-white/10 bg-white/[0.025] text-[#8e9b9e]",
    warning: "border-[#f4c66a]/20 bg-[#f4c66a]/[0.06] text-[#d8b972]",
    danger: "border-[#ff8a8a]/20 bg-[#ff8a8a]/[0.06] text-[#e99a9a]",
  };

  return (
    <div className={`flex items-start gap-2.5 rounded-lg border px-3.5 py-3 text-xs leading-5 ${tones[tone]}`}>
      <ExclamationCircleIcon className="mt-0.5 h-4 w-4 shrink-0" />
      <span>{children}</span>
    </div>
  );
}
