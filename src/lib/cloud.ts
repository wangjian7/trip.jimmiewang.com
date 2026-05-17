export type CloudTripGetResponse = {
  plan: unknown;
  updatedAt?: string;
};

export type CloudTripPutResponse = {
  ok: boolean;
  updatedAt?: string;
};

export type CloudPhotoUploadResponse = {
  ok: boolean;
  key: string;
  url: string;
};

export function getCloudPhotoUrl(key: string) {
  return `/api/photos?key=${encodeURIComponent(key)}`;
}

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

export async function uploadPhotoToCloud(
  slug: string,
  dayId: string,
  writeKey: string,
  file: File,
) {
  const formData = new FormData();
  formData.set("slug", slug);
  formData.set("dayId", dayId);
  formData.set("file", file, file.name);

  const res = await fetch("/api/photos", {
    method: "POST",
    headers: {
      "x-write-key": writeKey,
    },
    body: formData,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Photo upload failed: ${res.status} ${text}`);
  }

  return (await res.json()) as CloudPhotoUploadResponse;
}

export async function deletePhotoFromCloud(
  slug: string,
  key: string,
  writeKey: string,
) {
  const res = await fetch(
    `/api/photos?slug=${encodeURIComponent(slug)}&key=${encodeURIComponent(key)}`,
    {
      method: "DELETE",
      headers: {
        "x-write-key": writeKey,
      },
    },
  );

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Photo delete failed: ${res.status} ${text}`);
  }
}
