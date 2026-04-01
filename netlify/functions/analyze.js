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

function detectTechnologies(html) {
  if (!html || html.length < 100) return { fetchFailed: true };
  const h = html;
  const hl = html.toLowerCase();
  const detected = { fetchFailed: false };

  // GTM — patterns multiples
  const gtmId = h.match(/GTM-[A-Z0-9]{4,}/);
  if (gtmId) detected.gtm = gtmId[0];
  else if (hl.includes('googletagmanager.com/gtm.js') || hl.includes('datalayer') || h.includes('dataLayer')) detected.gtm = 'présent';

  // GA4
  const ga4Id = h.match(/['"](G-[A-Z0-9]{6,})['"]/);
  if (ga4Id) detected.ga4 = ga4Id[1];
  else if (hl.includes('gtag/js?id=g-') || hl.includes("gtag('config','g-") || hl.includes('google-analytics.com/g/collect')) detected.ga4 = 'présent';

  // Universal Analytics (GA3)
  const uaId = h.match(/['"](UA-\d{5,}-\d)['"]/);
  if (uaId) detected.ga3 = uaId[1];

  // Meta Pixel
  const fbId = h.match(/fbq\s*\(\s*['"]init['"]\s*,\s*['"](\d{10,})['"]/);
  if (fbId) detected.metaPixel = fbId[1];
  else if (hl.includes('fbq(') || hl.includes('fbevents.js') || hl.includes('connect.facebook.net')) detected.metaPixel = 'présent';

  // HubSpot
  const hsId = h.match(/js\.hs-scripts\.com\/(\d{6,})/);
  if (hsId) detected.hubspot = 'portal ' + hsId[1];
  else if (hl.includes('js.hubspot.com') || hl.includes('js.hs-scripts.com')) detected.hubspot = 'présent';

  // Klaviyo
  const klavId = h.match(/klaviyo\.com\/[^"']*company_id=([A-Z0-9]{4,})/i);
  if (klavId) detected.klaviyo = klavId[1];
  else if (hl.includes('klaviyo.com') || hl.includes('klaviyo')) detected.klaviyo = 'présent';

  // LinkedIn
  if (hl.includes('snap.licdn.com') || hl.includes('_linkedin_partner_id') || hl.includes('linkedin insight')) detected.linkedin = 'présent';

  // Hotjar
  const hjId = h.match(/hjid[:\s,'"]+(\d{4,})/);
  if (hjId) detected.hotjar = 'hjid:' + hjId[1];
  else if (hl.includes('static.hotjar.com') || hl.includes('hotjar')) detected.hotjar = 'présent';

  // Microsoft Clarity
  const clarityId = h.match(/clarity\s*\(\s*['"]set['"]\s*,\s*['"]([A-Z0-9]{8,})['"]/i);
  if (clarityId) detected.clarity = clarityId[1];
  else if (hl.includes('clarity.ms') || hl.includes('microsoft clarity')) detected.clarity = 'présent';

  // Brevo / Sendinblue
  if (hl.includes('sibautomation.com') || hl.includes('sendinblue') || hl.includes('brevo')) detected.brevo = 'présent';

  // Mailchimp
  if (hl.includes('chimpstatic.com') || hl.includes('list-manage.com') || hl.includes('mailchimp')) detected.mailchimp = 'présent';

  // Intercom
  if (hl.includes('intercom') || hl.includes('widget.intercom.io')) detected.intercom = 'présent';

  // Tidio
  if (hl.includes('tidiochat') || hl.includes('tidio.co')) detected.tidio = 'présent';

  // Crisp
  if (hl.includes('crisp.chat') || hl.includes('$crisp')) detected.crisp = 'présent';

  // RGPD
  const rgpdTools = {
    cookiebot: 'cookiebot',
    axeptio: 'axeptio',
    didomi: 'didomi',
    onetrust: 'onetrust',
    tarteaucitron: 'tarteaucitron',
    consentmanager: 'consentmanager',
    usercentrics: 'usercentrics',
    trustcommander: 'trustcommander',
  };
  for (const [name, pattern] of Object.entries(rgpdTools)) {
    if (hl.includes(pattern)) { detected.rgpd = name; break; }
  }

  // CMS
  if (hl.includes('cdn.shopify.com') || hl.includes('shopify')) detected.cms = 'Shopify';
  else if (hl.includes('/themes/classic/') || hl.includes('prestashop') || hl.includes('presta_')) detected.cms = 'PrestaShop';
  else if (hl.includes('wp-content') || hl.includes('wp-includes') || hl.includes('woocommerce')) detected.cms = 'WordPress/WooCommerce';

  // Search Console verification
  const scVerif = h.match(/google-site-verification['":\s]+([A-Za-z0-9_-]{20,})/);
  if (scVerif) detected.searchConsole = 'vérifié: ' + scVerif[1].slice(0, 12) + '...';

  // E-commerce tracking signals
  if (hl.includes('"purchase"') || hl.includes("'purchase'") || hl.includes('ecommerce') || hl.includes('transaction')) detected.ecomTracking = 'signaux détectés';

  // Réseaux sociaux (URLs dans le HTML)
  const socialPatterns = {
    instagram: /(?:href|content)=["'][^"']*instagram\.com\/([A-Za-z0-9._]{2,30})/,
    facebook: /(?:href|content)=["'][^"']*facebook\.com\/([A-Za-z0-9.]{2,60})/,
    linkedin: /(?:href|content)=["'][^"']*linkedin\.com\/(?:company|in)\/([A-Za-z0-9_-]{2,60})/,
    youtube: /(?:href|content)=["'][^"']*youtube\.com\/(?:channel|c|@|user)\/([A-Za-z0-9_-]{2,60})/,
    tiktok: /(?:href|content)=["'][^"']*tiktok\.com\/@([A-Za-z0-9._]{2,40})/,
    twitter: /(?:href|content)=["'][^"']*(?:twitter|x)\.com\/([A-Za-z0-9_]{1,40})/,
    pinterest: /(?:href|content)=["'][^"']*pinterest\.[a-z]{2,3}\/([A-Za-z0-9_]{2,40})/,
  };
  detected.socialLinks = {};
  for (const [net, pattern] of Object.entries(socialPatterns)) {
    const m = html.match(pattern);
    if (m && !['share', 'sharer', 'intent', 'login', 'signup', 'help', 'about', 'policies'].includes(m[1].toLowerCase())) {
      detected.socialLinks[net] = m[1];
    }
  }

  return detected;
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

    // Route fetch_source : récupère le HTML et détecte les technologies
    if (body.action === 'fetch_source') {
      const targetUrl = body.url;
      if (!targetUrl) return { statusCode: 400, body: JSON.stringify({ error: 'url required' }) };

      let html = '';
      let fetchError = null;

      // Tentative 1 : fetch standard avec bon User-Agent
      try {
        const res = await fetch(targetUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'fr-FR,fr;q=0.9,en;q=0.8',
            'Accept-Encoding': 'gzip, deflate, br',
            'Cache-Control': 'no-cache',
          },
          redirect: 'follow',
          signal: AbortSignal.timeout(8000),
        });
        if (res.ok) html = await res.text();
        else fetchError = 'HTTP ' + res.status;
      } catch (e1) {
        fetchError = e1.message;
        // Tentative 2 : URL sans trailing slash
        try {
          const cleanUrl = targetUrl.replace(/\/$/, '');
          const res2 = await fetch(cleanUrl, {
            headers: { 'User-Agent': 'Googlebot/2.1 (+http://www.google.com/bot.html)' },
            signal: AbortSignal.timeout(6000),
          });
          if (res2.ok) html = await res2.text();
        } catch (e2) { /* silencieux */ }
      }

      const technologies = detectTechnologies(html);
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({
          technologies,
          htmlLength: html.length,
          fetchError: fetchError || null,
          // Retourner les 60k premiers chars pour l'analyse du contenu
          html: html.slice(0, 60000)
        })
      };
    }

    // Route Anthropic standard
    const { prompt, model, max_tokens } = body;
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model: model || 'claude-haiku-4-5-20251001',
        max_tokens: max_tokens || 1000,
        system: "Tu es un assistant qui répond UNIQUEMENT en JSON valide. Pas de markdown, pas de texte avant ou après le JSON, pas de backticks, pas d'astérisques. Commence toujours par { et termine toujours par }.",
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
