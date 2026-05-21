export type Trail = {
  id: string;
  name: string;
  lat: number;
  lng: number;
};

export type LatLng = { lat: number; lng: number };

const COORD_REGEX = /-?\d+\.\d+/g;

export function parseLatLngInput(raw: string): LatLng | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  const direct = trimmed.match(/^(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)$/);
  if (direct) {
    return { lat: parseFloat(direct[1]), lng: parseFloat(direct[2]) };
  }

  const atMatch = trimmed.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (atMatch) {
    return { lat: parseFloat(atMatch[1]), lng: parseFloat(atMatch[2]) };
  }

  const bangMatch = trimmed.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/);
  if (bangMatch) {
    return { lat: parseFloat(bangMatch[1]), lng: parseFloat(bangMatch[2]) };
  }

  const queryMatch = trimmed.match(/[?&](?:q|ll|destination)=(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (queryMatch) {
    return { lat: parseFloat(queryMatch[1]), lng: parseFloat(queryMatch[2]) };
  }

  if (trimmed.startsWith("http")) {
    const nums = trimmed.match(COORD_REGEX);
    if (nums && nums.length >= 2) {
      const lat = parseFloat(nums[0]);
      const lng = parseFloat(nums[1]);
      if (isFinite(lat) && isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180) {
        return { lat, lng };
      }
    }
  }

  return null;
}

export function isShortGoogleMapsUrl(raw: string): boolean {
  return /https?:\/\/(maps\.app\.goo\.gl|goo\.gl\/maps)\//i.test(raw.trim());
}

export function makeTrailId(): string {
  return Math.random().toString(36).slice(2, 10);
}

function toBase64Url(str: string): string {
  if (typeof window === "undefined") {
    return Buffer.from(str, "utf8").toString("base64url");
  }
  const b64 = btoa(unescape(encodeURIComponent(str)));
  return b64.replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}

function fromBase64Url(str: string): string {
  const padded = str.replaceAll("-", "+").replaceAll("_", "/") + "===".slice((str.length + 3) % 4);
  if (typeof window === "undefined") {
    return Buffer.from(padded, "base64").toString("utf8");
  }
  return decodeURIComponent(escape(atob(padded)));
}

export function encodeTrailsToParam(trails: Trail[]): string {
  const compact = trails.map(({ name, lat, lng }) => ({ n: name, a: lat, o: lng }));
  return toBase64Url(JSON.stringify(compact));
}

export function decodeTrailsFromParam(param: string): Trail[] | null {
  try {
    const compact = JSON.parse(fromBase64Url(param)) as Array<{ n: string; a: number; o: number }>;
    if (!Array.isArray(compact)) return null;
    return compact.map((c) => ({
      id: makeTrailId(),
      name: String(c.n),
      lat: Number(c.a),
      lng: Number(c.o),
    }));
  } catch {
    return null;
  }
}

const STORAGE_KEY = "mtb-commute:trails:v1";

export function loadTrailsFromStorage(): Trail[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Trail[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveTrailsToStorage(trails: Trail[]): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(trails));
}
