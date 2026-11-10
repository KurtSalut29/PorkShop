"use client";

import { useEffect, useRef, useState } from "react";
import { ImagePlus, Loader2, RefreshCw, Trash2, UploadCloud } from "lucide-react";
import { notify } from "@/components/feedback/notify";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const MAX_BYTES = 10 * 1024 * 1024;
const ACCEPT = "image/jpeg,image/png,image/webp,image/avif,image/heic,image/heif";

type Uploaded = { url: string; imageStyle: "cutout" | "photo"; width: number; height: number };
type State =
  | { kind: "idle" }
  | { kind: "uploading"; preview: string; name: string; progress: number }
  | { kind: "error"; message: string };

/** Sends one photo to the owner-only upload route, reporting progress (fetch can't). */
function upload(file: File, onProgress: (pct: number) => void) {
  return new Promise<Uploaded>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/uploads/product-image");
    xhr.responseType = "json";
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(Math.round((e.loaded / e.total) * 100));
    xhr.onload = () => {
      const body = xhr.response as (Uploaded & { message?: string }) | null;
      if (xhr.status >= 200 && xhr.status < 300 && body?.url) resolve(body);
      else reject(new Error(body?.message ?? "We couldn’t save that photo. Please try again."));
    };
    xhr.onerror = () => reject(new Error("Couldn’t reach the shop’s server. Check your connection and try again."));
    const fd = new FormData();
    fd.append("file", file);
    xhr.send(fd);
  });
}

const sizeLabel = (bytes: number) => (bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.round(bytes / 1024)} KB`);

/**
 * Product photo field: drop or choose a photo, it uploads right away and the product form
 * submits its URL in a hidden `imageUrl` input. Nothing changes on the product until it's saved.
 */
export function PhotoUpload({
  id,
  value,
  onChange,
  error,
}: {
  /** Id of the file input, so the field's label opens the file picker. */
  id: string;
  value: string;
  onChange: (next: { url: string; imageStyle?: "cutout" | "photo" }) => void;
  error?: string;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [state, setState] = useState<State>({ kind: "idle" });
  const [dragging, setDragging] = useState(false);
  const [info, setInfo] = useState<string | null>(null);

  // Free the local preview once it's no longer shown.
  const preview = state.kind === "uploading" ? state.preview : null;
  useEffect(() => () => void (preview && URL.revokeObjectURL(preview)), [preview]);

  const choose = () => input.current?.click();

  const accept = async (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      const message = "That file isn’t a photo. Use a JPG, PNG or WebP image.";
      setState({ kind: "error", message });
      notify.error("Photo not added", message);
      return;
    }
    if (file.size > MAX_BYTES) {
      const message = `That photo is ${sizeLabel(file.size)}. The limit is 10 MB.`;
      setState({ kind: "error", message });
      notify.error("Photo too large", message);
      return;
    }
    setState({ kind: "uploading", preview: URL.createObjectURL(file), name: file.name, progress: 0 });
    try {
      const saved = await upload(file, (progress) => setState((s) => (s.kind === "uploading" ? { ...s, progress } : s)));
      onChange({ url: saved.url, imageStyle: saved.imageStyle });
      setInfo(`${saved.width} × ${saved.height} px`);
      setState({ kind: "idle" });
      notify.success("Photo uploaded", "Save the product to show it in the shop.");
    } catch (err) {
      const message = err instanceof Error ? err.message : "We couldn’t save that photo. Please try again.";
      setState({ kind: "error", message });
      notify.error("Photo not uploaded", message);
    } finally {
      if (input.current) input.current.value = ""; // allow choosing the same file again
    }
  };

  const busy = state.kind === "uploading";
  const shown = busy ? state.preview : value;
  const message = state.kind === "error" ? state.message : error;

  return (
    <div>
      <input type="hidden" name="imageUrl" value={value} />
      <input
        ref={input}
        id={id}
        type="file"
        accept={ACCEPT}
        className="sr-only"
        tabIndex={-1}
        onChange={(e) => accept(e.target.files?.[0])}
      />
      <div
        onDragOver={(e) => {
          e.preventDefault();
          if (!busy) setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          if (!busy) accept(e.dataTransfer.files?.[0]);
        }}
        className={cn(
          "rounded-xl border-2 border-dashed transition-colors",
          dragging ? "border-primary bg-primary/[0.04]" : message ? "border-destructive/50" : "border-border",
        )}
      >
        {shown ? (
          <div className="flex flex-col gap-4 p-3 sm:flex-row sm:items-center">
            <div className="relative aspect-[4/3] w-full shrink-0 overflow-hidden rounded-lg bg-muted sm:w-44">
              {/* eslint-disable-next-line @next/next/no-img-element -- local blob preview or freshly uploaded photo */}
              <img src={shown} alt="Product photo" className={cn("size-full object-cover", busy && "opacity-60")} />
              {busy && (
                <div className="absolute inset-0 grid place-items-center">
                  <span className="flex items-center gap-1.5 rounded-full bg-night/85 px-2.5 py-1 font-mono text-xs text-white">
                    <Loader2 className="size-3.5 animate-spin" /> {state.progress}%
                  </span>
                </div>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{busy ? `Uploading ${state.name}…` : "Product photo"}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {busy ? "You can keep filling in the form." : (info ?? "Shown on the shop, product page and cart.")}
              </p>
              {busy ? (
                <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full bg-primary transition-[width]" style={{ width: `${state.progress}%` }} />
                </div>
              ) : (
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button type="button" size="sm" variant="outline" onClick={choose}>
                    <RefreshCw className="size-3.5" /> Replace photo
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                    onClick={() => {
                      onChange({ url: "" });
                      setInfo(null);
                      notify.info("Photo removed", "Save the product to apply. The category illustration is shown instead.");
                    }}
                  >
                    <Trash2 className="size-3.5" /> Remove
                  </Button>
                </div>
              )}
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={choose}
            className="flex w-full flex-col items-center gap-2 rounded-[10px] px-4 py-8 text-center outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <span className="grid size-11 place-items-center rounded-full bg-primary/10 text-primary">
              {dragging ? <UploadCloud className="size-5" /> : <ImagePlus className="size-5" />}
            </span>
            <span className="text-sm font-medium">
              {dragging ? "Drop to upload" : (
                <>
                  Drag a photo here or <span className="text-primary underline-offset-2 hover:underline">choose a file</span>
                </>
              )}
            </span>
            <span className="text-xs text-muted-foreground">JPG, PNG or WebP · up to 10 MB · at least 300 px wide</span>
          </button>
        )}
      </div>
      {message ? (
        <p className="mt-1.5 text-[13px] text-destructive" role="alert">
          {message}
        </p>
      ) : (
        <p className="mt-1.5 text-xs text-muted-foreground">
          Tip: a photo on a plain white background blends into the shop’s tiles. Without a photo, the category illustration is shown.
        </p>
      )}
    </div>
  );
}
