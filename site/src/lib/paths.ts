export const basePath = import.meta.env.BASE_URL.endsWith('/')
  ? import.meta.env.BASE_URL
  : `${import.meta.env.BASE_URL}/`;

export function withBase(relativePath = ''): string {
  return `${basePath}${relativePath.replace(/^\/+/, '')}`;
}
export function skillHref(skillName: string): string {
  return withBase(`skills/${encodeURIComponent(skillName)}/`);
}

export function fileHref(skillName: string, filePath: string): string {
  const [pathname, fragment] = filePath.split('#', 2);
  const encodedPath = pathname.split('/').map(segment => encodeURIComponent(segment)).join('/');
  return `${withBase(`skills/${encodeURIComponent(skillName)}/files/${encodedPath}/`)}${fragment ? `#${encodeURIComponent(fragment)}` : ''}`;
}

export function rawFileHref(skillName: string, filePath: string): string {
  const encodedPath = filePath.split('/').map(segment => encodeURIComponent(segment)).join('/');
  return withBase(`downloads/skills/${encodeURIComponent(skillName)}/${encodedPath}`);
}

export function zipHref(skillName: string): string {
  return withBase(`downloads/${encodeURIComponent(skillName)}.zip`);
}

export function formatDate(value: string | null): string {
  if (!value) {
    return '—';
  }
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(value));
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
