import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/modules/auth/AuthContext";
import type { Role } from "@/lib/roles";

export function ProtectedRoute({ roles, children }: { roles: Role[]; children: ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;
  if (!roles.includes(user.role)) return <Navigate to="/login" replace />;

  return <>{children}</>;
}
