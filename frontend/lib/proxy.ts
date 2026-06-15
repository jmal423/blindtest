export function getProxiedUrl(url: string | null | undefined): string | undefined {
  if (!url) return undefined;
  if (url.startsWith('/')) return url;
  if (url.includes('cdn.discordapp.com')) return url;
  if (url.includes('/proxy')) return url;

  // Use backend proxy for audio files
  const backendUrl = process.env.NEXT_PUBLIC_API_URL || '';
  return `${backendUrl}/api/proxy/audio?url=${encodeURIComponent(url)}`;
}
