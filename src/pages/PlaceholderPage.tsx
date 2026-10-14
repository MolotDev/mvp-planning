import { useLocation } from "react-router-dom";
import { getPageTitle } from "@/lib/translations";

export function PlaceholderPage() {
  const { pathname } = useLocation();
  const title = getPageTitle(pathname);

  return (
    <section className="flex h-full w-full items-start">
      <h1 className="text-3xl font-semibold tracking-tight text-primitive-neutral-0">{title}</h1>
    </section>
  );
}
