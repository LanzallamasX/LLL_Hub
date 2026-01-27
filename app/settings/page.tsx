"use client";
import UserLayout from "@/components/layout/UserLayout";
import { useAuth } from "@/contexts/AuthContext";

export default function SettingsPage() {
  const { role } = useAuth();

  return (
    <UserLayout mode={role === "owner" ? "owner" : "user"} header={{ title: "Configuración", subtitle: "Preferencias y seguridad." }}>
      <div className="rounded-2xl border border-lll-border bg-lll-bg-soft p-6 text-sm text-lll-text-soft">
        Próximamente.
      </div>
    </UserLayout>
  );
}
