"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

const MapPicker = dynamic(() => import("@/components/MapPicker"), { ssr: false });
import {
  encodeTrailsToParam,
  isShortGoogleMapsUrl,
  loadCategoriesFromStorage,
  loadTrailsFromStorage,
  makeTrailId,
  parseLatLngInput,
  saveCategoriesToStorage,
  saveTrailsToStorage,
  type Trail,
} from "@/lib/trails";

type Draft = {
  id: string;
  name: string;
  raw: string;
  category?: string;
};

function toDraft(trail: Trail): Draft {
  return { id: trail.id, name: trail.name, raw: `${trail.lat}, ${trail.lng}`, category: trail.category };
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
    trails.push({ id: d.id, name: d.name.trim(), lat: parsed.lat, lng: parsed.lng, category: d.category });
  }
  return { trails, errors };
}

export default function SettingsPage() {
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [openMapId, setOpenMapId] = useState<string | null>(null);
  const [addressInputs, setAddressInputs] = useState<Record<string, string>>({});
  const [addressErrors, setAddressErrors] = useState<Record<string, string>>({});
  const [addressLoading, setAddressLoading] = useState<Record<string, boolean>>({});
  const [categories, setCategories] = useState<string[]>([]);
  const [categoryInput, setCategoryInput] = useState("");
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [categoryUrls, setCategoryUrls] = useState<{ category: string; url: string }[]>([]);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  useEffect(() => {
    const stored = loadTrailsFromStorage();
    setDrafts(stored.length > 0 ? stored.map(toDraft) : [emptyDraft(), emptyDraft(), emptyDraft(), emptyDraft()]);
    setCategories(loadCategoriesFromStorage());
  }, []);

  const { trails, errors } = useMemo(() => buildTrails(drafts), [drafts]);

  const updateDraft = (id: string, patch: Partial<Draft>) => {
    setDrafts((prev) => prev.map((d) => (d.id === id ? { ...d, ...patch } : d)));
    setShareUrl(null);
    setCategoryUrls([]);
    setCopiedKey(null);
  };

  const searchAddress = async (draftId: string) => {
    const q = addressInputs[draftId]?.trim();
    if (!q) return;
    setAddressLoading((prev) => ({ ...prev, [draftId]: true }));
    setAddressErrors((prev) => ({ ...prev, [draftId]: "" }));
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=1&countrycodes=us`,
      );
      const data = await res.json();
      if (!Array.isArray(data) || data.length === 0) {
        setAddressErrors((prev) => ({ ...prev, [draftId]: "Address not found — try adding a city or state." }));
        return;
      }
      const { lat, lon } = data[0] as { lat: string; lon: string };
      updateDraft(draftId, { raw: `${parseFloat(lat).toFixed(6)}, ${parseFloat(lon).toFixed(6)}` });
      setAddressInputs((prev) => ({ ...prev, [draftId]: "" }));
    } catch {
      setAddressErrors((prev) => ({ ...prev, [draftId]: "Search failed — check your connection." }));
    } finally {
      setAddressLoading((prev) => ({ ...prev, [draftId]: false }));
    }
  };

  const addDraft = () => setDrafts((prev) => [...prev, emptyDraft()]);
  const removeDraft = (id: string) => setDrafts((prev) => prev.filter((d) => d.id !== id));

  const addCategory = () => {
    const name = categoryInput.trim();
    if (!name || categories.includes(name)) return;
    setCategories((prev) => [...prev, name]);
    setCategoryInput("");
  };

  const removeCategory = (name: string) => {
    setCategories((prev) => prev.filter((c) => c !== name));
    setDrafts((prev) => prev.map((d) => (d.category === name ? { ...d, category: undefined } : d)));
  };

  const onSave = () => {
    saveTrailsToStorage(trails);
    saveCategoriesToStorage(categories);
    const param = encodeTrailsToParam(trails, categories);
    setShareUrl(`${window.location.origin}/?config=${param}`);
    setCategoryUrls(
      categories
        .map((cat) => {
          const catTrails = trails.filter((t) => t.category === cat);
          if (catTrails.length === 0) return null;
          return {
            category: cat,
            url: `${window.location.origin}/?config=${encodeTrailsToParam(catTrails, [cat])}`,
          };
        })
        .filter((x): x is { category: string; url: string } => x !== null),
    );
    setCopiedKey(null);
  };

  const onCopy = async (key: string, url: string) => {
    await navigator.clipboard.writeText(url);
    setCopiedKey(key);
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

      {/* Category manager */}
      <section className="mb-8 rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
        <h2 className="mb-3 text-sm font-semibold text-zinc-900 dark:text-zinc-100">Categories</h2>
        <div className="flex gap-2">
          <input
            type="text"
            value={categoryInput}
            onChange={(e) => setCategoryInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addCategory();
              }
            }}
            placeholder="e.g. Mountain Bike Trails"
            className="flex-1 rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-zinc-900 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:focus:border-zinc-100"
          />
          <button
            type="button"
            onClick={addCategory}
            disabled={!categoryInput.trim() || categories.includes(categoryInput.trim())}
            className="rounded-md bg-zinc-900 px-3 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
          >
            Add
          </button>
        </div>
        {categories.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {categories.map((cat) => (
              <span
                key={cat}
                className="flex items-center gap-1 rounded-full bg-zinc-100 px-3 py-1 text-xs font-medium dark:bg-zinc-800"
              >
                {cat}
                <button
                  type="button"
                  onClick={() => removeCategory(cat)}
                  aria-label={`Remove ${cat}`}
                  className="ml-0.5 text-zinc-400 hover:text-red-600 dark:hover:text-red-400"
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        )}
      </section>

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
                <div>
                  <div className="mb-1 flex items-center justify-between">
                    <span className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
                      Google Maps URL or lat,lng
                    </span>
                    <button
                      type="button"
                      onClick={() => setOpenMapId(openMapId === draft.id ? null : draft.id)}
                      className="text-xs text-zinc-500 underline-offset-2 hover:text-zinc-900 hover:underline dark:hover:text-zinc-100"
                    >
                      {openMapId === draft.id ? "Close map" : "Pick on map"}
                    </button>
                  </div>
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
                  <div className="mt-3">
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={addressInputs[draft.id] ?? ""}
                        onChange={(e) =>
                          setAddressInputs((prev) => ({ ...prev, [draft.id]: e.target.value }))
                        }
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            searchAddress(draft.id);
                          }
                        }}
                        placeholder="Search US address…"
                        className="flex-1 rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-zinc-900 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:focus:border-zinc-100"
                      />
                      <button
                        type="button"
                        onClick={() => searchAddress(draft.id)}
                        disabled={!addressInputs[draft.id]?.trim() || addressLoading[draft.id]}
                        className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm font-medium shadow-sm hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-950 dark:hover:bg-zinc-900"
                      >
                        {addressLoading[draft.id] ? "…" : "Search"}
                      </button>
                    </div>
                    {addressErrors[draft.id] && (
                      <span className="mt-1 block text-xs text-red-600 dark:text-red-400">
                        {addressErrors[draft.id]}
                      </span>
                    )}
                  </div>
                  {openMapId === draft.id && (
                    <div className="mt-2">
                      <MapPicker
                        value={parseLatLngInput(draft.raw)}
                        onChange={(lat, lng) =>
                          updateDraft(draft.id, { raw: `${lat.toFixed(6)}, ${lng.toFixed(6)}` })
                        }
                      />
                      <p className="mt-1 text-xs text-zinc-500">Click the map to drop a pin</p>
                    </div>
                  )}
                </div>
                {categories.length > 0 && (
                  <label className="block">
                    <span className="mb-1 block text-xs font-medium text-zinc-700 dark:text-zinc-300">
                      Category
                    </span>
                    <select
                      value={draft.category ?? ""}
                      onChange={(e) => updateDraft(draft.id, { category: e.target.value || undefined })}
                      className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-zinc-900 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:focus:border-zinc-100"
                    >
                      <option value="">No category</option>
                      {categories.map((cat) => (
                        <option key={cat} value={cat}>
                          {cat}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
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
          <div className="mt-3 space-y-1.5">
            {[
              { label: "All trails", key: "all", url: shareUrl },
              ...categoryUrls.map((c) => ({ label: c.category, key: c.category, url: c.url })),
            ].map(({ label, key, url }) => (
              <div
                key={key}
                className="flex items-center justify-between gap-3 rounded-md bg-zinc-100 px-3 py-2 dark:bg-zinc-900"
              >
                <span className="text-xs text-zinc-600 dark:text-zinc-400">{label}</span>
                <button
                  type="button"
                  onClick={() => onCopy(key, url)}
                  className="shrink-0 text-xs font-medium text-zinc-800 hover:text-zinc-900 dark:text-zinc-200 dark:hover:text-zinc-100"
                >
                  {copiedKey === key ? "✓ Copied" : "Copy link"}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
