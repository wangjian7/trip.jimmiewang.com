export type CloudTripGetResponse = {
  plan: unknown;
  updatedAt?: string;
};

export type CloudTripPutResponse = {
  ok: boolean;
  updatedAt?: string;
};

export async function getTripFromCloud(slug: string) {
  const res = await fetch(`/api/trips/${encodeURIComponent(slug)}`, {
    method: "GET",
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Cloud GET failed: ${res.status}`);
  return (await res.json()) as CloudTripGetResponse;
}

export async function saveTripToCloud(slug: string, writeKey: string, plan: unknown) {
  const res = await fetch(`/api/trips/${encodeURIComponent(slug)}`, {
    method: "PUT",
    headers: {
      "content-type": "application/json",
      "x-write-key": writeKey,
    },
    body: JSON.stringify({ plan }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Cloud PUT failed: ${res.status} ${text}`);
  }
  return (await res.json()) as CloudTripPutResponse;
}

