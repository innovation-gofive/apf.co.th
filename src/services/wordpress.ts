const API_URL = import.meta.env.PUBLIC_WORDPRESS_API;
const mediaCache = new Map<number, Promise<any>>();

export async function fetchAPI(endpoint: string) {
  const response = await fetch(`${API_URL}${endpoint}`, {
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`WordPress API Error: ${response.status}`);
  }

  return await response.json();
}
export async function getMedia(id: number) {
  if (!mediaCache.has(id)) {
    mediaCache.set(id, fetchAPI(`/media/${id}`));
  }

  return await mediaCache.get(id);
}



export async function getMediaList(ids: Array<number | null | undefined>) {
  const mediaIds = [...new Set(ids.filter((id): id is number => Boolean(id)))];
  const mediaById = new Map<number, string>();

  // WordPress caps a media request at 100 items. Batching avoids one HTTP
  // request per icon/image, which makes server-rendered pages much faster.
  const batches = Array.from({ length: Math.ceil(mediaIds.length / 100) }, (_, index) =>
    mediaIds.slice(index * 100, (index + 1) * 100),
  );

  await Promise.all(
    batches.map(async (batch) => {
      if (!batch.length) return;

      const media = await fetchAPI(`/media?include=${batch.join(",")}&per_page=${batch.length}`);
      media.forEach((item: { id: number; source_url: string }) => {
        mediaById.set(item.id, item.source_url);
        mediaCache.set(item.id, Promise.resolve(item));
      });
    }),
  );

  return ids.map((id) => (id ? mediaById.get(id) ?? null : null));
}

export async function getPageBySlug(slug: string) {
  const pages = await fetchAPI(`/pages?slug=${slug}`);

  if (!pages.length) {
    throw new Error(`Page "${slug}" not found`);
  }

  return pages[0];
}

export async function getMediaMap(fields: unknown) {
  const ids = new Set<number>();

  const collect = (value: unknown) => {
    if (typeof value === "number") ids.add(value);
    if (Array.isArray(value)) value.forEach(collect);
    if (value && typeof value === "object") Object.values(value).forEach(collect);
  };

  collect(fields);
  const mediaIds = [...ids];
  const mediaUrls = await getMediaList(mediaIds);
  return Object.fromEntries(
    mediaIds.flatMap((id, index) => (mediaUrls[index] ? [[id, mediaUrls[index]] as const] : [])),
  ) as Record<number, string>;
}
