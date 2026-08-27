const API_URL = import.meta.env.PUBLIC_WORDPRESS_API;

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
  return await fetchAPI(`/media/${id}`);
}



export async function getMediaList(ids: Array<number | null | undefined>) {
  return Promise.all(
    ids.map(async (id) => {
      if (!id) {
        return null;
      }

      const media = await getMedia(id);
      return media.source_url;
    })
  );
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
  const media = await Promise.all([...ids].map(async (id) => [id, (await getMedia(id)).source_url] as const));
  return Object.fromEntries(media) as Record<number, string>;
}
