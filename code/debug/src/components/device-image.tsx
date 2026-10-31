"use client";

import { Camera, Download } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { relativeTime } from "@/lib/utils";
import type { DebugDeviceSummary } from "@/lib/schemas";

function extensionFor(mimeType: string): string {
  const subtype = mimeType.split("/")[1]?.toLowerCase();
  if (!subtype) return "bin";
  if (subtype === "jpeg") return "jpg";
  if (subtype === "svg+xml") return "svg";
  return subtype;
}

export function DeviceImage({ summary }: { summary: DebugDeviceSummary }) {
  const { device, lastImage, stale } = summary;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="font-mono text-sm">{device.id}</CardTitle>
          <div className="flex items-center gap-1">
            <Badge variant={device.mode === "cloud" ? "info" : "muted"}>{device.mode}</Badge>
            {stale ? <Badge variant="warning">stale</Badge> : <Badge variant="success">live</Badge>}
          </div>
        </div>
        <CardDescription>
          {device.hardware} · stand {device.stand}
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="relative aspect-video w-full overflow-hidden rounded-md border bg-black">
          {lastImage ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={lastImage.url}
                alt={`Last frame from ${device.id}`}
                className="h-full w-full object-contain"
              />
              <a
                href={lastImage.url}
                download={`${device.id}-${lastImage.seq}.${extensionFor(lastImage.mimeType)}`}
                target="_blank"
                rel="noreferrer"
                aria-label={`Download frame #${lastImage.seq} from ${device.id}`}
                className="absolute right-2 top-2 inline-flex h-8 w-8 items-center justify-center rounded-md bg-black/60 text-white backdrop-blur-sm hover:bg-black/80 focus:outline-none focus:ring-2 focus:ring-white/50"
              >
                <Download className="h-4 w-4" />
              </a>
            </>
          ) : (
            <div className="flex h-full w-full flex-col items-center justify-center gap-2 text-[var(--color-muted-foreground)]">
              <Camera className="h-6 w-6" />
              <p className="text-xs">
                {device.mode === "device" ? "device-mode: no image uploaded" : "no image yet"}
              </p>
            </div>
          )}
        </div>
        {lastImage ? (
          <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
            <dt className="text-[var(--color-muted-foreground)]">received</dt>
            <dd className="text-right font-mono">{relativeTime(lastImage.receivedAt)}</dd>
            <dt className="text-[var(--color-muted-foreground)]">seq</dt>
            <dd className="text-right font-mono">#{lastImage.seq}</dd>
            {typeof lastImage.occupied === "number" && (
              <>
                <dt className="text-[var(--color-muted-foreground)]">cloud count</dt>
                <dd className="text-right font-mono">{lastImage.occupied}</dd>
              </>
            )}
            {typeof lastImage.deviceCount === "number" && (
              <>
                <dt className="text-[var(--color-muted-foreground)]">device count</dt>
                <dd className="text-right font-mono">{lastImage.deviceCount}</dd>
              </>
            )}
            {typeof lastImage.meanConfidence === "number" && (
              <>
                <dt className="text-[var(--color-muted-foreground)]">mean conf.</dt>
                <dd className="text-right font-mono">
                  {(lastImage.meanConfidence * 100).toFixed(1)}%
                </dd>
              </>
            )}
          </dl>
        ) : null}
      </CardContent>
    </Card>
  );
}
