export function getProxiedUrl(url: string | null | undefined): string | undefined {
  if (!url) return undefined;
  if (url.startsWith('/')) return url;
  if (url.includes('cdn.discordapp.com')) return url;
  if (url.includes('api/proxy')) return url; // Already proxied

  // Return the proxy URL
  return `/api/proxy?url=${encodeURIComponent(url)}`;
}
