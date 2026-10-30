"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn, formatTimestamp } from "@/lib/utils";
import type { BadgeProps } from "@/components/ui/badge";
import type { LogEntry, LogLevel } from "@/lib/schemas";

const LEVEL_VARIANT: Record<LogLevel, BadgeProps["variant"]> = {
  debug: "muted",
  info: "info",
  warn: "warning",
  error: "danger",
};

export function DeviceLogs({
  entries,
  loading,
  error,
  title = "Logs",
}: {
  entries: LogEntry[];
  loading?: boolean;
  error?: string | null;
  title?: string;
}) {
  return (
    <Card className="flex h-full flex-col">
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <CardTitle>{title}</CardTitle>
          <span className="text-xs text-[var(--color-muted-foreground)]">
            {loading ? "loading…" : `${entries.length} entries`}
          </span>
        </div>
      </CardHeader>
      <CardContent className="flex-1 overflow-hidden pt-0">
        {error ? (
          <div className="rounded-md border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-200">
            {error}
          </div>
        ) : null}
        <div className="max-h-[70vh] overflow-y-auto rounded-md border bg-black/40 font-mono text-xs">
          {entries.length === 0 && !loading ? (
            <div className="p-4 text-center text-[var(--color-muted-foreground)]">
              no log entries
            </div>
          ) : (
            <ul className="divide-y divide-[var(--color-border)]/60">
              {entries.map((entry, i) => (
                <li
                  key={`${entry.deviceId}-${entry.at}-${i}`}
                  className="grid grid-cols-[auto_auto_auto_1fr] items-start gap-3 px-3 py-2"
                >
                  <span className="text-[var(--color-muted-foreground)]">
                    {formatTimestamp(entry.at)}
                  </span>
                  <Badge variant={LEVEL_VARIANT[entry.level]} className="justify-self-start">
                    {entry.level}
                  </Badge>
                  <span className={cn("text-[var(--color-muted-foreground)]")}>
                    {entry.deviceId}
                  </span>
                  <span className="whitespace-pre-wrap break-words text-[var(--color-foreground)]">
                    {entry.message}
                    {entry.context && Object.keys(entry.context).length > 0 ? (
                      <span className="ml-2 text-[var(--color-muted-foreground)]">
                        {JSON.stringify(entry.context)}
                      </span>
                    ) : null}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
