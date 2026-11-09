"use client";

import { useEffect } from "react";
import { RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <div className="grid min-h-[60dvh] place-items-center px-6">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold">Something went wrong</h1>
        <p className="mt-2 text-muted-foreground">
          This screen hit an unexpected problem. Your data is safe. Please try again.
        </p>
        {error.digest && <p className="num mt-2 text-xs text-muted-foreground">Reference: {error.digest}</p>}
        <Button className="mt-6" onClick={reset}>
          <RotateCcw className="size-4" /> Try again
        </Button>
      </div>
    </div>
  );
}
