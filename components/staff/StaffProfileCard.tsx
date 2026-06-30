"use client";

import { Briefcase, Building2, CalendarDays, Phone, Wallet } from "lucide-react";

type StaffProfileCardProps = {
  name: string;
  role: string;
  phone?: string | null;
  monthlySalary?: number | null;
  status?: string | null;
  masjidName?: string | null;
  joinedAt?: string | null;
  canManageSalary?: boolean;
  onPaySalary?: () => void;
};

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] || "?";
  const last = parts.length > 1 ? parts[parts.length - 1]?.[0] || "" : "";
  return `${first}${last}`.toUpperCase();
}

function formatCurrency(value?: number | null) {
  return `Rs. ${Number(value || 0).toLocaleString()}`;
}

function formatDate(value?: string | null) {
  if (!value) return "Not available";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

function formatStatus(status?: string | null) {
  return status ? status.replace(/_/g, " ") : "active";
}

export function StaffProfileCard(props: StaffProfileCardProps) {
  const {
    name,
    role,
    phone,
    monthlySalary,
    status,
    masjidName,
    joinedAt,
    canManageSalary = false,
    onPaySalary,
  } = props;

  return (
    <section className="rounded-3xl border border-neutral-200 bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex items-start gap-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-emerald-100 text-lg font-black text-emerald-700">
            {initials(name)}
          </div>

          <div className="min-w-0">
            <h2 className="truncate text-2xl font-black text-neutral-900">{name}</h2>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-bold uppercase tracking-wide text-emerald-700">
                {role}
              </span>
              <span className="rounded-full border border-neutral-200 bg-neutral-50 px-3 py-1 text-xs font-bold uppercase tracking-wide text-neutral-600">
                {formatStatus(status)}
              </span>
            </div>
          </div>
        </div>

        {canManageSalary && onPaySalary && (
          <button
            type="button"
            onClick={onPaySalary}
            className="inline-flex items-center justify-center rounded-2xl bg-emerald-600 px-5 py-3 text-sm font-bold text-white transition hover:bg-emerald-700"
          >
            Pay Salary
          </button>
        )}
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl bg-neutral-50 p-4">
          <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-neutral-500">
            <Briefcase className="h-4 w-4" />
            Role
          </div>
          <p className="text-sm font-semibold text-neutral-900">{role}</p>
        </div>

        <div className="rounded-2xl bg-neutral-50 p-4">
          <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-neutral-500">
            <Phone className="h-4 w-4" />
            Contact
          </div>
          <p className="text-sm font-semibold text-neutral-900">{phone || "Not provided"}</p>
        </div>

        <div className="rounded-2xl bg-neutral-50 p-4">
          <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-neutral-500">
            <Wallet className="h-4 w-4" />
            Monthly Salary
          </div>
          <p className="text-sm font-semibold text-neutral-900">{formatCurrency(monthlySalary)}</p>
        </div>

        <div className="rounded-2xl bg-neutral-50 p-4">
          <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-neutral-500">
            <Building2 className="h-4 w-4" />
            Assigned Mosque
          </div>
          <p className="text-sm font-semibold text-neutral-900">{masjidName || "Current tenant"}</p>
        </div>
      </div>

      <div className="mt-4 flex items-center gap-2 text-xs font-medium text-neutral-500">
        <CalendarDays className="h-4 w-4" />
        <span>Joined: {formatDate(joinedAt)}</span>
      </div>
    </section>
  );
}
