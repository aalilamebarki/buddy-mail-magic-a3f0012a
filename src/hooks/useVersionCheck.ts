import { useQuery } from '@tanstack/react-query';

export const CURRENT_VERSION = '1.0.0';
export const VERSION_URL = 'https://raw.githubusercontent.com/aalilamebarki/Laweyrewith/main/version.json';

export interface VersionManifest {
  version: string;
  changelog: string;
  features?: string[];
  date?: string;
}

function compareVersions(a: string, b: string): number {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const na = pa[i] ?? 0;
    const nb = pb[i] ?? 0;
    if (na > nb) return 1;
    if (na < nb) return -1;
  }
  return 0;
}

export function useVersionCheck(enabled = true) {
  const query = useQuery<VersionManifest>({
    queryKey: ['version-check'],
    queryFn: async () => {
      const res = await fetch(VERSION_URL, { cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
    retry: 1,
    enabled,
  });

  const hasUpdate = query.data
    ? compareVersions(query.data.version, CURRENT_VERSION) > 0
    : false;

  return { ...query, hasUpdate, remote: query.data ?? null, CURRENT_VERSION };
}
