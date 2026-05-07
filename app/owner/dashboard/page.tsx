import { Suspense } from "react";
import OwnerDashboardPageClient from "./OwnerDashboardPageClient";
import EmailTestCard from "@/components/EmailTestCard";

export default function OwnerDashboardPage() {
  return (
    <Suspense fallback={null}>
      <OwnerDashboardPageClient />
      <EmailTestCard />
    </Suspense>
  );
}