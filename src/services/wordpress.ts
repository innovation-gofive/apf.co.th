const API_URL =
  import.meta.env.PUBLIC_WORDPRESS_API || "https://cms.apf.co.th/wp-json/wp/v2";
const MEDIA_CACHE_TTL = 60_000;

type WordPressMediaSize = {
  source_url?: string;
  width?: number;
  height?: number;
};

export type WordPressMedia = {
  id: number;
  source_url: string;
  modified?: string;
  modified_gmt?: string;
  media_details?: {
    width?: number;
    height?: number;
    sizes?: Record<string, WordPressMediaSize>;
  };
  srcset?: string;
};

const mediaCache = new Map<number, { expiresAt: number; media: WordPressMedia }>();

function withMediaVersion(media: WordPressMedia): WordPressMedia {
  const version = media.modified_gmt || media.modified;

  const versionedUrl = (url: string) => {
    if (!version) return url;
    const separator = url.includes("?") ? "&" : "?";
    return `${url}${separator}ver=${encodeURIComponent(version)}`;
  };

  const candidates = [
    ...(Object.values(media.media_details?.sizes ?? {})),
    { source_url: media.source_url, width: media.media_details?.width },
  ].filter((size): size is Required<Pick<WordPressMediaSize, "source_url" | "width">> =>
    Boolean(size.source_url && size.width),
  );

  const srcset = [...new Map(candidates.map((size) => [size.width, size])).values()]
    .sort((a, b) => a.width - b.width)
    .map((size) => `${versionedUrl(size.source_url)} ${size.width}w`)
    .join(", ");

  return {
    ...media,
    source_url: versionedUrl(media.source_url),
    srcset: srcset || undefined,
  };
}

function cacheMedia(media: WordPressMedia) {
  const versionedMedia = withMediaVersion(media);
  mediaCache.set(versionedMedia.id, {
    media: versionedMedia,
    expiresAt: Date.now() + MEDIA_CACHE_TTL,
  });
  return versionedMedia;
}

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
  const cached = mediaCache.get(id);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.media;
  }

  return cacheMedia(await fetchAPI(`/media/${id}`));
}



export async function getMediaDetailsList(ids: Array<number | null | undefined>) {
  const mediaIds = [...new Set(ids.filter((id): id is number => Boolean(id)))];
  const mediaById = new Map<number, WordPressMedia>();

  // WordPress caps a media request at 100 items. Batching avoids one HTTP
  // request per icon/image, which makes server-rendered pages much faster.
  const batches = Array.from({ length: Math.ceil(mediaIds.length / 100) }, (_, index) =>
    mediaIds.slice(index * 100, (index + 1) * 100),
  );

  await Promise.all(
    batches.map(async (batch) => {
      if (!batch.length) return;

      const media = await fetchAPI(`/media?include=${batch.join(",")}&per_page=${batch.length}`);
      media.forEach((item: WordPressMedia) => {
        const versionedMedia = cacheMedia(item);
        mediaById.set(versionedMedia.id, versionedMedia);
      });
    }),
  );

  return ids.map((id) => (id ? mediaById.get(id) ?? null : null));
}

export async function getMediaList(ids: Array<number | null | undefined>) {
  const media = await getMediaDetailsList(ids);
  return media.map((item) => item?.source_url ?? null);
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
