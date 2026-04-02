 const ipRequests = {};
const LIMIT = 10;
const WINDOW_MS = 3600000;

function checkRateLimit(ip) {
  const now = Date.now();
  if (!ipRequests[ip]) ipRequests[ip] = { count: 0, windowStart: now };
  const r = ipRequests[ip];
  if (now - r.windowStart > WINDOW_MS) { r.count = 0; r.windowStart = now; }
  r.count++;
  return { allowed: r.count <= LIMIT, remaining: Math.max(0, LIMIT - r.count), resetIn: Math.ceil((r.windowStart + WINDOW_MS - now) / 60000) };
}

setInterval(() => {
  const now = Date.now();
  for (const ip in ipRequests) { if (now - ipRequests[ip].windowStart > WINDOW_MS * 2) delete ipRequests[ip]; }
}, 3600000);

// Détection maison depuis HTML statique (fallback)
function detectFromHTML(html) {
  if (!html || html.length < 100) return { fetchFailed: true };
  const h = html;
  const hl = html.toLowerCase();
  const d = { fetchFailed: false, source: 'html' };

  const gtmId = h.match(/GTM-[A-Z0-9]{4,}/);
  if (gtmId) d.gtm = gtmId[0];
  else if (hl.includes('googletagmanager.com/gtm.js') || h.includes('dataLayer')) d.gtm = 'présent';

  const ga4Id = h.match(/['"](G-[A-Z0-9]{6,})['"]/);
  if (ga4Id) d.ga4 = ga4Id[1];
  else if (hl.includes('gtag/js?id=g-')) d.ga4 = 'présent';

  const fbId = h.match(/fbq\s*\(\s*['"]init['"]\s*,\s*['"](\d{10,})['"]/);
  if (fbId) d.metaPixel = fbId[1];
  else if (hl.includes('fbq(') || hl.includes('fbevents.js')) d.metaPixel = 'présent';

  const hsId = h.match(/js\.hs-scripts\.com\/(\d{6,})/);
  if (hsId) d.hubspot = 'portal ' + hsId[1];
  else if (hl.includes('js.hubspot.com')) d.hubspot = 'présent';

  if (hl.includes('klaviyo.com')) d.klaviyo = 'présent';
  if (hl.includes('snap.licdn.com') || hl.includes('_linkedin_partner_id')) d.linkedin = 'présent';

  const hjId = h.match(/hjid[:\s,'"]+(\d{4,})/);
  if (hjId) d.hotjar = 'hjid:' + hjId[1];
  else if (hl.includes('static.hotjar.com')) d.hotjar = 'présent';

  if (hl.includes('clarity.ms')) d.clarity = 'présent';
  if (hl.includes('sibautomation.com') || hl.includes('sendinblue') || hl.includes('brevo')) d.brevo = 'présent';
  if (hl.includes('chimpstatic.com') || hl.includes('mailchimp')) d.mailchimp = 'présent';
  if (hl.includes('intercom') || hl.includes('widget.intercom.io')) d.intercom = 'présent';
  if (hl.includes('tidiochat') || hl.includes('tidio.co')) d.tidio = 'présent';
  if (hl.includes('crisp.chat') || hl.includes('$crisp')) d.crisp = 'présent';

  const rgpdTools = { cookiebot:'cookiebot', axeptio:'axeptio', didomi:'didomi', onetrust:'onetrust', tarteaucitron:'tarteaucitron', consentmanager:'consentmanager' };
  for (const [name, pat] of Object.entries(rgpdTools)) { if (hl.includes(pat)) { d.rgpd = name; break; } }

  if (hl.includes('cdn.shopify.com')) d.cms = 'Shopify';
  else if (hl.includes('/themes/classic/') || hl.includes('prestashop')) d.cms = 'PrestaShop';
  else if (hl.includes('wp-content') || hl.includes('wp-includes')) d.cms = 'WordPress';

  const scV = h.match(/google-site-verification['":\s]+([A-Za-z0-9_-]{20,})/);
  if (scV) d.searchConsole = 'vérifié';

  if (hl.includes('"purchase"') || hl.includes('ecommerce')) d.ecomTracking = 'signaux détectés';

  d.socialLinks = {};
  const socials = {
    instagram: /href=["'][^"']*instagram\.com\/([A-Za-z0-9._]{2,30})/,
    facebook: /href=["'][^"']*facebook\.com\/([A-Za-z0-9.]{2,60})/,
    linkedin: /href=["'][^"']*linkedin\.com\/(?:company|in)\/([A-Za-z0-9_-]{2,60})/,
    youtube: /href=["'][^"']*youtube\.com\/(?:channel|c|@|user)\/([A-Za-z0-9_-]{2,60})/,
    tiktok: /href=["'][^"']*tiktok\.com\/@([A-Za-z0-9._]{2,40})/,
    twitter: /href=["'][^"']*(?:twitter|x)\.com\/([A-Za-z0-9_]{1,40})/,
    pinterest: /href=["'][^"']*pinterest\.[a-z]{2,3}\/([A-Za-z0-9_]{2,40})/,
  };
  const skipHandles = ['share','sharer','intent','login','signup','help','about','policies','legal'];
  for (const [net, pat] of Object.entries(socials)) {
    const m = html.match(pat);
    if (m && !skipHandles.includes(m[1].toLowerCase())) d.socialLinks[net] = m[1];
  }

  // Résumé contenu
  const titleM = html.match(/<title[^>]*>([^<]{3,150})<\/title>/i);
  const h1M = html.match(/<h1[^>]*>([^<]{3,150})<\/h1>/i);
  const metaM = html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']{10,300})["']/i)
               || html.match(/<meta[^>]+content=["']([^"']{10,300})["'][^>]+name=["']description["']/i);
  const h2s = [...html.matchAll(/<h2[^>]*>([^<]{3,80})<\/h2>/gi)].map(m => m[1].replace(/<[^>]+>/g,'').trim()).slice(0,5);
  const schemaM = html.match(/"@type"\s*:\s*"([A-Za-z]+)"/g);

  d._content = {
    title: titleM ? titleM[1].trim() : '',
    h1: h1M ? h1M[1].replace(/<[^>]+>/g,'').trim() : '',
    metaDesc: metaM ? metaM[1].trim() : '',
    h2s: h2s,
    hasFaq: /faq|foire aux questions|questions fr.quentes/i.test(html),
    schemaTypes: schemaM ? [...new Set(schemaM.map(s => s.match(/"([A-Za-z]+)"/g)[1].replace(/"/g,'')))].join(', ') : '',
    hasReviews: /trustpilot|avis verifi|review|rating/i.test(html),
    hasCart: /panier|cart|checkout/i.test(html),
    internalLinks: (html.match(/href=["'][^"'#][^"']*["']/g)||[]).length,
  };

  return d;
}

// Fusion des résultats urlscan avec les données HTML
function mergeUrlscanData(htmlTech, urlscanData) {
  if (!urlscanData) return htmlTech;
  const merged = { ...htmlTech, source: 'urlscan+html' };

  const techs = urlscanData.page && urlscanData.page.technologies ? urlscanData.page.technologies : [];
  const techNames = techs.map(t => t.name.toLowerCase());

  const techMap = {
    'google tag manager': () => { merged.gtm = merged.gtm || 'détecté (urlscan)'; },
    'google analytics': () => { merged.ga4 = merged.ga4 || 'GA détecté (urlscan)'; },
    'google analytics 4': () => { merged.ga4 = merged.ga4 || 'GA4 détecté (urlscan)'; },
    'facebook pixel': () => { merged.metaPixel = merged.metaPixel || 'détecté (urlscan)'; },
    'hotjar': () => { merged.hotjar = merged.hotjar || 'détecté (urlscan)'; },
    'hubspot': () => { merged.hubspot = merged.hubspot || 'détecté (urlscan)'; },
    'klaviyo': () => { merged.klaviyo = merged.klaviyo || 'détecté (urlscan)'; },
    'microsoft clarity': () => { merged.clarity = merged.clarity || 'détecté (urlscan)'; },
    'linkedin insight tag': () => { merged.linkedin = merged.linkedin || 'détecté (urlscan)'; },
    'brevo': () => { merged.brevo = merged.brevo || 'détecté (urlscan)'; },
    'sendinblue': () => { merged.brevo = merged.brevo || 'détecté (urlscan)'; },
    'intercom': () => { merged.intercom = merged.intercom || 'détecté (urlscan)'; },
    'crisp': () => { merged.crisp = merged.crisp || 'détecté (urlscan)'; },
    'tidio': () => { merged.tidio = merged.tidio || 'détecté (urlscan)'; },
    'cookiebot': () => { merged.rgpd = merged.rgpd || 'cookiebot'; },
    'axeptio': () => { merged.rgpd = merged.rgpd || 'axeptio'; },
    'onetrust': () => { merged.rgpd = merged.rgpd || 'onetrust'; },
    'shopify': () => { merged.cms = merged.cms || 'Shopify'; },
    'prestashop': () => { merged.cms = merged.cms || 'PrestaShop'; },
    'woocommerce': () => { merged.cms = merged.cms || 'WordPress/WooCommerce'; },
  };

  for (const [techKey, fn] of Object.entries(techMap)) {
    if (techNames.some(n => n.includes(techKey))) fn();
  }

  return merged;
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' }, body: '' };
  }
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };

  const ip = event.headers['x-forwarded-for']?.split(',')[0]?.trim() || 'unknown';
  const { allowed, remaining, resetIn } = checkRateLimit(ip);
  if (!allowed) {
    return { statusCode: 429, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ error: { type: 'rate_limit_error', message: 'Limite atteinte. Réessayez dans ' + resetIn + ' minute(s).' } }) };
  }

  try {
    const body = JSON.parse(event.body);

    // === Route fetch_source : HTML maison + urlscan en parallèle ===
    if (body.action === 'fetch_source') {
      const targetUrl = body.url;
      if (!targetUrl) return { statusCode: 400, body: JSON.stringify({ error: 'url required' }) };

      // Extraire le domaine
      const domain = targetUrl.replace(/^https?:\/\//, '').replace(/\/.*$/, '');

      // Lancer en parallèle : fetch HTML direct + urlscan search (résultats existants)
      const [htmlResult, urlscanResult] = await Promise.allSettled([
        // Fetch HTML direct
        (async () => {
          const res = await fetch(targetUrl, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
              'Accept': 'text/html,application/xhtml+xml,*/*;q=0.8',
              'Accept-Language': 'fr-FR,fr;q=0.9',
            },
            redirect: 'follow',
            signal: AbortSignal.timeout(8000),
          });
          if (res.ok) return await res.text();
          return '';
        })(),
        // urlscan.io : chercher scan récent (API gratuite, pas besoin de clé pour la recherche)
        (async () => {
          const urlscanSearch = await fetch(
            'https://urlscan.io/api/v1/search/?q=domain:' + domain + '&size=1&sort=date:desc',
            { headers: { 'Accept': 'application/json' }, signal: AbortSignal.timeout(5000) }
          );
          if (!urlscanSearch.ok) return null;
          const data = await urlscanSearch.json();
          const results = data.results || [];
          if (results.length === 0) return null;
          // Récupérer les détails du scan le plus récent
          const uuid = results[0].task && results[0].task.uuid;
          if (!uuid) return results[0]; // retourner ce qu'on a
          const detail = await fetch('https://urlscan.io/api/v1/result/' + uuid + '/', {
            signal: AbortSignal.timeout(5000)
          });
          if (!detail.ok) return results[0];
          return await detail.json();
        })(),
      ]);

      const html = htmlResult.status === 'fulfilled' ? (htmlResult.value || '') : '';
      const urlscanData = urlscanResult.status === 'fulfilled' ? urlscanResult.value : null;

      // Détection depuis HTML
      let technologies = detectFromHTML(html);

      // Enrichir avec urlscan si disponible
      if (urlscanData) {
        technologies = mergeUrlscanData(technologies, urlscanData);
        technologies._urlscanDate = urlscanData.task && urlscanData.task.time ? urlscanData.task.time.slice(0,10) : 'récent';
      }

      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({
          technologies,
          htmlLength: html.length,
          urlscanFound: !!urlscanData,
          fetchError: htmlResult.status === 'rejected' ? htmlResult.reason.message : null,
        })
      };
    }

    // === Route Anthropic standard ===
    const { prompt, model, max_tokens } = body;
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model: model || 'claude-haiku-4-5-20251001',
        max_tokens: max_tokens || 1000,
        system: "Tu es un expert marketing digital de ROAR Agency. Tu analyses des sites web et tu restitues des diagnostics clairs et accessibles pour des dirigeants de TPE/PME. Ton style : direct, humain, expert qui explique sans jargon. Tu nommes ce qui fonctionne bien avant ce qui manque. Tu ne dramatises jamais — tu dis 'à renforcer' plutôt qu'alarmer. Tu réponds UNIQUEMENT en JSON valide, sans markdown, sans backticks, sans astérisques. Tu commences toujours par { et termines par }.",
        messages: [{ role: 'user', content: prompt }],
      }),
    });
    const data = await response.json();
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', 'X-RateLimit-Remaining': String(remaining) },
      body: JSON.stringify(data)
    };

  } catch (err) {
    return { statusCode: 500, headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify({ error: err.message }) };
  }
};
