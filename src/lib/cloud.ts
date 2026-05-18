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

async function readErrorCode(res: Response) {
  const text = await res.text().catch(() => "");

  try {
    const parsed = JSON.parse(text) as { error?: string };
    return parsed.error ?? "";
  } catch {
    return text;
  }
}

function toUserFacingError(action: "get" | "save" | "upload" | "delete", status: number, code: string) {
  if (status === 401 || status === 403) {
    return "编辑口令不正确，请重新输入后再试。";
  }

  if (status === 404) {
    if (action === "get") return "云端还没有这份行程。";
    return "没有找到对应内容，请刷新后再试。";
  }

  if (code.includes("bucket_not_bound")) {
    return "图片服务暂时不可用，请稍后再试。";
  }

  if (code.includes("trip_not_found")) {
    return "请先把行程保存到云端，再继续操作。";
  }

  if (action === "get") return "暂时无法从云端恢复，请稍后再试。";
  if (action === "save") return "暂时无法保存到云端，请稍后再试。";
  if (action === "upload") return "照片上传失败，请稍后再试。";
  return "暂时无法删除照片，请稍后再试。";
}

export function getCloudPhotoUrl(key: string) {
  return `/api/photos?key=${encodeURIComponent(key)}`;
}

export async function getTripFromCloud(slug: string) {
  const res = await fetch(`/api/trips/${encodeURIComponent(slug)}`, {
    method: "GET",
  });
  if (res.status === 404) return null;
  if (!res.ok) {
    const code = await readErrorCode(res);
    throw new Error(toUserFacingError("get", res.status, code));
  }
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
    const code = await readErrorCode(res);
    throw new Error(toUserFacingError("save", res.status, code));
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
    const code = await readErrorCode(res);
    throw new Error(toUserFacingError("upload", res.status, code));
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
    const code = await readErrorCode(res);
    throw new Error(toUserFacingError("delete", res.status, code));
  }
}
