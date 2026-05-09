import { Suspense } from "react";
import OwnerDashboardPageClient from "./OwnerDashboardPageClient";

export default function OwnerDashboardPage() {
  return (
    <Suspense fallback={null}>
      <OwnerDashboardPageClient />
    </Suspense>
  );
}