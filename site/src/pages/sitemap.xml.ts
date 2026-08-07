import { loadCatalog } from '../../../scripts/site-catalog.mjs';

export async function GET() {
  const catalog = await loadCatalog();
  const siteUrl = import.meta.env.SITE.replace(/\/$/, '');
  const urls = [
    `<url><loc>${siteUrl}/</loc></url>`,
    ...catalog.map(skill => `<url><loc>${siteUrl}/skills/${encodeURIComponent(skill.name)}/</loc>${skill.updatedAt ? `<lastmod>${skill.updatedAt}</lastmod>` : ''}</url>`),
  ];
  const body = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.join('')}</urlset>`;
  return new Response(body, { headers: { 'Content-Type': 'application/xml; charset=utf-8' } });
}
