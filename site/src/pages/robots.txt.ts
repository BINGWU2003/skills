export function GET() {
  const siteUrl = import.meta.env.SITE.replace(/\/$/, '');
  return new Response([
    'User-agent: *',
    'Allow: /',
    'Disallow: /skills/*/files/',
    `Sitemap: ${siteUrl}/sitemap.xml`,
    '',
  ].join('\n'), { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
}
