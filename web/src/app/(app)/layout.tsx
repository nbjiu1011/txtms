import { Suspense, type ReactNode } from "react";
import { Workspace } from "./workspace";

/** Authenticated workspace. `usePathname` needs a Suspense boundary under the catch-all route. */
export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <Suspense fallback={null}>
        <Workspace />
      </Suspense>
      {children}
    </>
  );
}
