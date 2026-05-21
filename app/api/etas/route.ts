import { NextResponse } from "next/server";

type LatLng = { lat: number; lng: number };

type EtaRequest = {
  origin: LatLng;
  destinations: Array<{ id: string; lat: number; lng: number }>;
};

type MatrixElement = {
  originIndex?: number;
  destinationIndex?: number;
  duration?: string;
  staticDuration?: string;
  distanceMeters?: number;
  condition?: string;
};

type EtaResult = {
  id: string;
  durationSeconds: number | null;
  staticDurationSeconds: number | null;
  distanceMeters: number | null;
  trafficDelaySeconds: number | null;
  condition: string | null;
};

function parseDurationSeconds(value: string | undefined): number | null {
  if (!value) return null;
  const match = value.match(/^(\d+(?:\.\d+)?)s$/);
  return match ? parseFloat(match[1]) : null;
}

function waypoint(lat: number, lng: number) {
  return { waypoint: { location: { latLng: { latitude: lat, longitude: lng } } } };
}

export async function POST(request: Request) {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "GOOGLE_MAPS_API_KEY is not configured on the server." },
      { status: 500 },
    );
  }

  let body: EtaRequest;
  try {
    body = (await request.json()) as EtaRequest;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  if (!body?.origin || !Array.isArray(body.destinations) || body.destinations.length === 0) {
    return NextResponse.json(
      { error: "Body must include { origin, destinations[] }." },
      { status: 400 },
    );
  }

  const googleBody = {
    origins: [waypoint(body.origin.lat, body.origin.lng)],
    destinations: body.destinations.map((d) => waypoint(d.lat, d.lng)),
    travelMode: "DRIVE",
    routingPreference: "TRAFFIC_AWARE",
  };

  const response = await fetch("https://routes.googleapis.com/distanceMatrix/v2:computeRouteMatrix", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask":
        "originIndex,destinationIndex,duration,staticDuration,distanceMeters,condition",
    },
    body: JSON.stringify(googleBody),
  });

  if (!response.ok) {
    const text = await response.text();
    return NextResponse.json(
      { error: `Routes API error: ${response.status} ${text}` },
      { status: 502 },
    );
  }

  const matrix = (await response.json()) as MatrixElement[];
  const results: EtaResult[] = body.destinations.map((dest, idx) => {
    const element = matrix.find((m) => m.destinationIndex === idx);
    const duration = parseDurationSeconds(element?.duration);
    const staticDuration = parseDurationSeconds(element?.staticDuration);
    return {
      id: dest.id,
      durationSeconds: duration,
      staticDurationSeconds: staticDuration,
      distanceMeters: element?.distanceMeters ?? null,
      trafficDelaySeconds:
        duration !== null && staticDuration !== null ? duration - staticDuration : null,
      condition: element?.condition ?? null,
    };
  });

  return NextResponse.json({ results, fetchedAt: new Date().toISOString() });
}
