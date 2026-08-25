import { Suspense } from "react";
import OwnerRequestsPageClient from "../dashboard/OwnerDashboardPageClient";
import OwnerRequestsRouteLoading from "../dashboard/OwnerDashboardRouteLoading";

export default function OwnerRequestsPage() {
  return (
    <Suspense fallback={<OwnerRequestsRouteLoading />}>
      <OwnerRequestsPageClient />
    </Suspense>
  );
}
