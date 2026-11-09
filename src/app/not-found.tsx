import Link from "next/link";
import { LogoMark } from "@/components/brand";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="grid min-h-dvh place-items-center px-6">
      <div className="max-w-md text-center">
        <LogoMark className="mx-auto size-10" />
        <p className="num mt-6 text-sm font-medium text-primary">404</p>
        <h1 className="mt-2 text-2xl font-semibold">We couldn't find that page</h1>
        <p className="mt-2 text-muted-foreground">The link may be outdated, or the order or product may no longer exist.</p>
        <div className="mt-6 flex justify-center gap-2">
          <Button asChild>
            <Link href="/dashboard">Go to my dashboard</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/shop">Browse the shop</Link>
          </Button>
        </div>
      </div>
    </main>
  );
}
