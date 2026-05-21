"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  encodeTrailsToParam,
  isShortGoogleMapsUrl,
  loadTrailsFromStorage,
  makeTrailId,
  parseLatLngInput,
  saveTrailsToStorage,
  type Trail,
} from "@/lib/trails";

type Draft = {
  id: string;
  name: string;
  raw: string;
};

function toDraft(trail: Trail): Draft {
  return { id: trail.id, name: trail.name, raw: `${trail.lat}, ${trail.lng}` };
}

function emptyDraft(): Draft {
  return { id: makeTrailId(), name: "", raw: "" };
}

function buildTrails(drafts: Draft[]): { trails: Trail[]; errors: Record<string, string> } {
  const trails: Trail[] = [];
  const errors: Record<string, string> = {};
  for (const d of drafts) {
    if (!d.name.trim() && !d.raw.trim()) continue;
    if (!d.name.trim()) {
      errors[d.id] = "Name is required";
      continue;
    }
    const parsed = parseLatLngInput(d.raw);
    if (!parsed) {
      errors[d.id] = isShortGoogleMapsUrl(d.raw)
        ? "Short maps.app.goo.gl links don't contain coordinates — open the link, then copy the long URL or paste 'lat,lng'."
        : "Paste a Google Maps URL with coordinates, or type 'lat,lng' (e.g. 37.7749,-122.4194).";
      continue;
    }
    trails.push({ id: d.id, name: d.name.trim(), lat: parsed.lat, lng: parsed.lng });
  }
  return { trails, errors };
}

export default function SettingsPage() {
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const stored = loadTrailsFromStorage();
    setDrafts(stored.length > 0 ? stored.map(toDraft) : [emptyDraft(), emptyDraft(), emptyDraft(), emptyDraft()]);
  }, []);

  const { trails, errors } = useMemo(() => buildTrails(drafts), [drafts]);

  const updateDraft = (id: string, patch: Partial<Draft>) => {
    setDrafts((prev) => prev.map((d) => (d.id === id ? { ...d, ...patch } : d)));
    setShareUrl(null);
    setCopied(false);
  };

  const addDraft = () => setDrafts((prev) => [...prev, emptyDraft()]);
  const removeDraft = (id: string) => setDrafts((prev) => prev.filter((d) => d.id !== id));

  const onSave = () => {
    saveTrailsToStorage(trails);
    const param = encodeTrailsToParam(trails);
    const url = `${window.location.origin}/?config=${param}`;
    setShareUrl(url);
    setCopied(false);
  };

  const onCopy = async () => {
    if (!shareUrl) return;
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
  };

  const previewParsed = (raw: string) => {
    const p = parseLatLngInput(raw);
    return p ? `${p.lat.toFixed(5)}, ${p.lng.toFixed(5)}` : null;
  };

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-8 sm:py-12">
      <header className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Trail settings</h1>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            Pinpoint the trailhead parking lots. Generate a shareable link to drop in WhatsApp.
          </p>
        </div>
        <Link
          href="/"
          className="text-sm font-medium text-zinc-700 underline-offset-4 hover:underline dark:text-zinc-300"
        >
          View ETAs →
        </Link>
      </header>

      <div className="space-y-4">
        {drafts.map((draft, idx) => {
          const parsed = previewParsed(draft.raw);
          const error = errors[draft.id];
          return (
            <div
              key={draft.id}
              className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950"
            >
              <div className="mb-3 flex items-center justify-between">
                <span className="text-xs font-medium uppercase tracking-wider text-zinc-500">
                  Trail {idx + 1}
                </span>
                <button
                  type="button"
                  onClick={() => removeDraft(draft.id)}
                  className="text-xs text-zinc-500 hover:text-red-600 dark:hover:text-red-400"
                >
                  Remove
                </button>
              </div>
              <div className="space-y-3">
                <label className="block">
                  <span className="mb-1 block text-xs font-medium text-zinc-700 dark:text-zinc-300">
                    Name
                  </span>
                  <input
                    type="text"
                    value={draft.name}
                    onChange={(e) => updateDraft(draft.id, { name: e.target.value })}
                    placeholder="e.g. Demo Forest Trailhead"
                    className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-zinc-900 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:focus:border-zinc-100"
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-xs font-medium text-zinc-700 dark:text-zinc-300">
                    Google Maps URL or lat,lng
                  </span>
                  <input
                    type="text"
                    value={draft.raw}
                    onChange={(e) => updateDraft(draft.id, { raw: e.target.value })}
                    placeholder="https://www.google.com/maps/...  or  37.7749, -122.4194"
                    className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 font-mono text-xs shadow-sm focus:border-zinc-900 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:focus:border-zinc-100"
                  />
                  {parsed && !error && (
                    <span className="mt-1 block text-xs text-green-700 dark:text-green-400">
                      ✓ Parsed: {parsed}
                    </span>
                  )}
                  {error && (
                    <span className="mt-1 block text-xs text-red-600 dark:text-red-400">{error}</span>
                  )}
                </label>
              </div>
            </div>
          );
        })}

        <button
          type="button"
          onClick={addDraft}
          className="w-full rounded-lg border border-dashed border-zinc-300 py-3 text-sm font-medium text-zinc-600 hover:border-zinc-500 hover:text-zinc-900 dark:border-zinc-700 dark:text-zinc-400 dark:hover:border-zinc-500 dark:hover:text-zinc-100"
        >
          + Add another trail
        </button>
      </div>

      <div className="sticky bottom-4 mt-8 rounded-lg border border-zinc-200 bg-white p-4 shadow-lg dark:border-zinc-800 dark:bg-zinc-950">
        <div className="flex items-center justify-between gap-3">
          <div className="text-xs text-zinc-600 dark:text-zinc-400">
            {trails.length} trail{trails.length === 1 ? "" : "s"} ready
          </div>
          <button
            type="button"
            onClick={onSave}
            disabled={trails.length === 0}
            className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
          >
            Save & generate link
          </button>
        </div>
        {shareUrl && (
          <div className="mt-3 space-y-2">
            <div className="break-all rounded-md bg-zinc-100 p-2 font-mono text-xs dark:bg-zinc-900">
              {shareUrl}
            </div>
            <button
              type="button"
              onClick={onCopy}
              className="w-full rounded-md border border-zinc-300 px-3 py-2 text-xs font-medium hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
            >
              {copied ? "✓ Copied — paste in WhatsApp" : "Copy shareable link"}
            </button>
          </div>
        )}
      </div>
    </main>
  );
}
