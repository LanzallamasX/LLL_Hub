import { Suspense } from "react";
import AbsencesPageClient from "./AbsencesPageClient";

export default function Page() {
  return (
    <Suspense fallback={null}>
      <AbsencesPageClient />
    </Suspense>
  );
}