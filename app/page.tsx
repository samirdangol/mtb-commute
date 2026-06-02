"use client";

import Link from "next/link";
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  decodeTrailsFromParam,
  loadCategoriesFromStorage,
  loadTrailsFromStorage,
  saveCategoriesToStorage,
  saveTrailsToStorage,
  type Trail,
} from "@/lib/trails";

type EtaResult = {
  id: string;
  durationSeconds: number | null;
  staticDurationSeconds: number | null;
  distanceMeters: number | null;
  trafficDelaySeconds: number | null;
  condition: string | null;
};

type LoadState = "idle" | "locating" | "fetching" | "ready" | "error";

function formatDuration(seconds: number | null): string {
  if (seconds === null) return "—";
  const mins = Math.round(seconds / 60);
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

function formatDistance(meters: number | null): string {
  if (meters === null) return "—";
  const miles = meters / 1609.344;
  return miles < 10 ? `${miles.toFixed(1)} mi` : `${Math.round(miles)} mi`;
}

function formatTrafficDelta(delaySeconds: number | null): { label: string; tone: "good" | "warn" | "bad" | "neutral" } {
  if (delaySeconds === null) return { label: "", tone: "neutral" };
  const mins = Math.round(delaySeconds / 60);
  if (mins <= 1) return { label: "Light traffic", tone: "good" };
  if (mins < 10) return { label: `+${mins} min traffic`, tone: "warn" };
  return { label: `+${mins} min traffic`, tone: "bad" };
}

function HomeContent() {
  const searchParams = useSearchParams();
  const [trails, setTrails] = useState<Trail[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [results, setResults] = useState<EtaResult[]>([]);
  const [state, setState] = useState<LoadState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [fetchedAt, setFetchedAt] = useState<string | null>(null);

  useEffect(() => {
    const configParam = searchParams.get("config");
    if (configParam) {
      const decoded = decodeTrailsFromParam(configParam);
      if (decoded && decoded.trails.length > 0) {
        setTrails(decoded.trails);
        setCategories(decoded.categories);
        saveTrailsToStorage(decoded.trails);
        saveCategoriesToStorage(decoded.categories);
        return;
      }
    }
    setTrails(loadTrailsFromStorage());
    setCategories(loadCategoriesFromStorage());
  }, [searchParams]);

  const fetchEtas = useCallback(
    async (origin: { lat: number; lng: number }) => {
      if (trails.length === 0) return;
      setState("fetching");
      setError(null);
      try {
        const response = await fetch("/api/etas", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            origin,
            destinations: trails.map((t) => ({ id: t.id, lat: t.lat, lng: t.lng })),
          }),
        });
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data?.error ?? "Failed to fetch drive times");
        }
        setResults(data.results);
        setFetchedAt(data.fetchedAt);
        setState("ready");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error");
        setState("error");
      }
    },
    [trails],
  );

  const refresh = useCallback(() => {
    if (trails.length === 0) return;
    setState("locating");
    setError(null);
    if (!navigator.geolocation) {
      setError("Geolocation not supported by this browser.");
      setState("error");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => fetchEtas({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      (err) => {
        setError(`Location denied or unavailable: ${err.message}`);
        setState("error");
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 },
    );
  }, [fetchEtas, trails]);

  useEffect(() => {
    if (trails.length > 0 && state === "idle") {
      refresh();
    }
  }, [trails, state, refresh]);

  const ranked = useMemo(() => {
    return trails
      .map((trail) => {
        const eta = results.find((r) => r.id === trail.id);
        return { trail, eta };
      })
      .sort((a, b) => {
        const ad = a.eta?.durationSeconds ?? Number.POSITIVE_INFINITY;
        const bd = b.eta?.durationSeconds ?? Number.POSITIVE_INFINITY;
        return ad - bd;
      });
  }, [trails, results]);

  // Group trails by category; falls back to a single ungrouped section when no categories are assigned.
  const grouped = useMemo(() => {
    const hasCategories = ranked.some((r) => r.trail.category);
    if (!hasCategories) return [{ label: null as string | null, items: ranked }];

    const groups: { label: string | null; items: typeof ranked }[] = [];
    const assignedIds = new Set<string>();

    for (const cat of categories) {
      const items = ranked.filter((r) => r.trail.category === cat);
      if (items.length > 0) {
        groups.push({ label: cat, items });
        items.forEach((r) => assignedIds.add(r.trail.id));
      }
    }

    const remaining = ranked.filter((r) => !assignedIds.has(r.trail.id));
    if (remaining.length > 0) {
      groups.push({ label: "Uncategorized", items: remaining });
    }

    return groups;
  }, [ranked, categories]);

  if (trails.length === 0) {
    return (
      <main className="mx-auto flex min-h-[70vh] w-full max-w-md flex-col items-center justify-center px-4 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">No trails set up yet</h1>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          Add your trailhead locations to see live drive times.
        </p>
        <Link
          href="/settings"
          className="mt-6 rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
        >
          Pinpoint trails →
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-6 sm:py-10">
      <header className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Trail drive times</h1>
          <p className="mt-1 text-xs text-zinc-500">
            {state === "locating" && "Getting your location…"}
            {state === "fetching" && "Calling traffic-aware routing…"}
            {state === "ready" && fetchedAt && `Updated ${new Date(fetchedAt).toLocaleTimeString()}`}
            {state === "error" && error}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={refresh}
            disabled={state === "locating" || state === "fetching"}
            className="rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-xs font-medium shadow-sm hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-950 dark:hover:bg-zinc-900"
          >
            {state === "locating" || state === "fetching" ? "…" : "Refresh"}
          </button>
          <Link
            href="/settings"
            className="rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-xs font-medium shadow-sm hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-950 dark:hover:bg-zinc-900"
          >
            Edit
          </Link>
        </div>
      </header>

      <div className="space-y-6">
        {grouped.map(({ label, items }) => (
          <section key={label ?? "__all"}>
            {label && (
              <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-500">
                {label}
              </h2>
            )}
            <ol className="space-y-3">
              {items.map(({ trail, eta }, idx) => {
                const delta = formatTrafficDelta(eta?.trafficDelaySeconds ?? null);
                const mapsLink = `https://www.google.com/maps/dir/?api=1&destination=${trail.lat},${trail.lng}&travelmode=driving`;
                return (
                  <li
                    key={trail.id}
                    className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-medium text-zinc-500">#{idx + 1}</span>
                          <h2 className="truncate text-base font-semibold">{trail.name}</h2>
                        </div>
                        <div className="mt-1 text-xs text-zinc-500">
                          {formatDistance(eta?.distanceMeters ?? null)}
                          {delta.label && (
                            <span
                              className={`ml-2 ${
                                delta.tone === "good"
                                  ? "text-green-700 dark:text-green-400"
                                  : delta.tone === "warn"
                                    ? "text-amber-700 dark:text-amber-400"
                                    : delta.tone === "bad"
                                      ? "text-red-700 dark:text-red-400"
                                      : ""
                              }`}
                            >
                              · {delta.label}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-2xl font-semibold tabular-nums">
                          {formatDuration(eta?.durationSeconds ?? null)}
                        </div>
                        <a
                          href={mapsLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-zinc-500 underline-offset-4 hover:underline"
                        >
                          Open in Maps ↗
                        </a>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ol>
          </section>
        ))}
      </div>
    </main>
  );
}

export default function HomePage() {
  return (
    <Suspense fallback={null}>
      <HomeContent />
    </Suspense>
  );
}
