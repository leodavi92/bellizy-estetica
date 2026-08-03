/**
 * SEO helper leve: atualiza <title> e metatags OG/Twitter no <head>.
 * Nenhuma dependência externa (não usa react-helmet) — zero bundle bloat.
 * Safe para SSR/CSR: fallback se document não existir.
 */

let cleanupFns = [];

function ensureMetaTag({ property = null, name = null, initialContent = '' }) {
  if (typeof document === 'undefined') return null;
  const attr = property ? 'property' : 'name';
  const value = property || name;
  let tag = document.head.querySelector(`meta[${attr}="${value}"]`);
  if (!tag) {
    tag = document.createElement('meta');
    tag.setAttribute(attr, value);
    tag.setAttribute('content', initialContent);
    document.head.appendChild(tag);
  }
  const original = tag.getAttribute('content');
  return { tag, original };
}

/**
 * Atualiza metatags da página e registra cleanup para rota desmontar.
 * @param {{
 *   title?: string,
 *   description?: string,
 *   image?: string,
 *   url?: string,
 *   type?: 'website' | 'article' | 'profile',
 *   locale?: string,
 *   siteName?: string,
 * }} params
 */
export function setPageSeo({
  title,
  description,
  image,
  url,
  type = 'website',
  locale = 'pt_BR',
  siteName = 'Musa Agenda'
}) {
  if (typeof document === 'undefined') return () => {};

  const cleanups = [];

  if (title) {
    const originalTitle = document.title;
    document.title = title.endsWith(siteName) ? title : `${title} • ${siteName}`;
    cleanups.push(() => { document.title = originalTitle; });
  }

  const tagsToUpsert = [
    { property: 'og:title', content: title },
    { property: 'og:description', content: description },
    { property: 'og:image', content: image },
    { property: 'og:url', content: url },
    { property: 'og:type', content: type },
    { property: 'og:site_name', content: siteName },
    { property: 'og:locale', content: locale },
    { name: 'description', content: description },
    { name: 'twitter:card', content: image ? 'summary_large_image' : 'summary' },
    { name: 'twitter:title', content: title },
    { name: 'twitter:description', content: description },
    { name: 'twitter:image', content: image },
  ].filter(t => t.content);

  for (const t of tagsToUpsert) {
    const res = ensureMetaTag({ property: t.property || null, name: t.name || null, initialContent: t.content });
    if (res) {
      const { tag, original } = res;
      tag.setAttribute('content', t.content);
      cleanups.push(() => {
        if (original != null) tag.setAttribute('content', original);
      });
    }
  }

  const token = Symbol('seo_cleanup');
  cleanupFns.push({ token, fns: cleanups });

  return () => {
    const idx = cleanupFns.findIndex(x => x.token === token);
    if (idx > -1) {
      const { fns } = cleanupFns[idx];
      fns.forEach(fn => { try { fn(); } catch (_) {} });
      cleanupFns.splice(idx, 1);
    }
  };
}

/**
 * React hook helper: useEffect cleanup pattern pronto.
 * Uso:
 *   usePageSeo({ title: `${est.nome} • Agendamento`, description, image: est.logo_url })
 */
import { useEffect } from 'react';

export function usePageSeo(params) {
  useEffect(() => {
    const url = typeof window !== 'undefined' ? window.location.href : undefined;
    const fullParams = { url, ...params };
    const cleanup = setPageSeo(fullParams);
    return cleanup;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, Object.values(params));
}

export default { setPageSeo, usePageSeo };
