"use client";

import { useEffect, useState } from "react";
import { connectLiveStands, type LiveStatus } from "@/lib/live-stands";
import { API_URL, type StandsMessage } from "@/lib/stands-api";

export interface LiveStands {
  status: LiveStatus;
  /** latest message; kept while reconnecting so the screen doesn't go blank */
  message: StandsMessage | null;
}

export function useLiveStands(apiUrl: string = API_URL): LiveStands {
  const [status, setStatus] = useState<LiveStatus>("connecting");
  const [message, setMessage] = useState<StandsMessage | null>(null);

  useEffect(
    () => connectLiveStands({ apiUrl, onStands: setMessage, onStatus: setStatus }),
    [apiUrl],
  );

  return { status, message };
}
