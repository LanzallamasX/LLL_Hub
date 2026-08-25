import { Suspense } from "react";
import AbsencesPageClient from "./AbsencesPageClient";
import AbsencesRouteLoading from "./AbsencesRouteLoading";

export default function Page() {
  return (
    <Suspense fallback={<AbsencesRouteLoading />}>
      <AbsencesPageClient />
    </Suspense>
  );
}
