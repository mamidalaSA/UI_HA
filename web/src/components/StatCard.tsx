import type { ReactNode } from "react";
import { Link } from "react-router-dom";

interface StatCardProps {
  icon: ReactNode;
  iconBg: string;
  label: string;
  value: string | number;
  linkTo?: string;
  linkLabel?: string;
}

export function StatCard({ icon, iconBg, label, value, linkTo, linkLabel = "View all" }: StatCardProps) {
  return (
    <div className="flex items-center gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${iconBg}`}>{icon}</div>
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-slate-500">{label}</p>
        <p className="text-2xl font-bold text-slate-900">{value}</p>
        {linkTo && (
          <Link to={linkTo} className="text-xs font-semibold text-blue-600 hover:underline">
            {linkLabel}
          </Link>
        )}
      </div>
    </div>
  );
}
