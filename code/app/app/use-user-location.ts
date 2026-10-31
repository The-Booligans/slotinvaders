"use client";

import { useEffect, useState } from "react";
import { watchUserLocation, type LocationState } from "@/lib/user-location";

export function useUserLocation(): LocationState {
  const [state, setState] = useState<LocationState>({ status: "locating" });
  useEffect(() => watchUserLocation(setState), []);
  return state;
}
