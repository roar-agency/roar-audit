const ipRequests = {};
const LIMIT = 10;
const WINDOW_MS = 3600000;

function checkRateLimit(ip) {
  const now = Date.now();
  if (!ipRequests[ip]) ipRequests[ip] = { count: 0, windowStart: now };
  const record = ipRequests[ip];
  if (now - record.windowStart > WINDOW_MS) { record.count = 0; record.windowStart = now; }
  record.count++;
  return { allowed: record.count <= LIMIT, remaining: Math.max(0, LIMIT - record.count), resetIn: Math.ceil((record.windowStart + WINDOW_MS - now) / 60000) };
}

setInterval(() => {
  const now = Date.now();
  for (const ip in ipRequests) { if (now - ipRequests[ip].windowStart > WINDOW_MS * 2) delete ipRequests[ip]; }
}, 3600000);

// Détection déterministe des technologies depuis le HTML source
function detectTechnologies(html) {
  const h = html || '';
  const detected = {};

  // GTM
  const gtmMatch = h.match(/GTM-[A-Z0-9]+/);
  if (gtmMatch) detected.gtm = gtmMatch[0];
  else if (h.includes('googletagmanager.com/gtm.js') || h.includes('dataLayer')) detected.gtm = 'présent';

  // GA4
  const ga4Match = h.match(/G-[A-Z0-9]{6,}/);
  if (ga4Match) detected.ga4 = ga4Match[0];
  else if (h.includes('gtag/js?id=G-') || h.includes("gtag('config','G-")) detected.ga4 = 'présent';

  // Meta Pixel
  const fbMatch = h.match(/fbq\('init',\s*['"](\d+)['"]/);
  if (fbMatch) detected.metaPixel = fbMatch[1];
  else if (h.includes('fbq(') || h.includes('fbevents.js')) detected.metaPixel = 'présent';

  // HubSpot
  const hsMatch = h.match(/js\.hs-scripts\.com\/(\d+)/);
  if (hsMatch) detected.hubspot = 'portal ' + hsMatch[1];
  else if (h.includes('js.hubspot.com') || h.includes('_hsp')) detected.hubspot = 'présent';

  // Klaviyo
  const klavMatch = h.match(/klaviyo\.com\/onsite\/js\/klaviyo\.js\?company_id=([A-Z0-9]+)/);
  if (klavMatch) detected.klaviyo = klavMatch[1];
  else if (h.includes('static.klaviyo.com')) detected.klaviyo = 'présent';

  // LinkedIn
  if (h.includes('snap.licdn.com') || h.includes('_linkedin_partner_id')) detected.linkedin = 'présent';

  // Hotjar
  const hjMatch = h.match(/hjid:(\d+)/);
  if (hjMatch) detected.hotjar = 'hjid:' + hjMatch[1];
  else if (h.includes('static.hotjar.com')) detected.hotjar = 'présent';

  // Clarity
  if (h.includes('clarity.ms') || h.includes('Microsoft Clarity')) detected.clarity = 'présent';

  // RGPD
  const rgpdTools = ['cookiebot','axeptio','didomi','onetrust','tarteaucitron','consentmanager','usercentrics'];
  for (const t of rgpdTools) { if (h.toLowerCase().includes(t)) { detected.rgpd = t; break; } }

  // Brevo / Sendinblue
  if (h.includes('sibautomation.com') || h.includes('sendinblue')) detected.brevo = 'présent';

  // Mailchimp
  if (h.includes('chimpstatic.com') || h.includes('list-manage.com')) detected.mailchimp = 'présent';

  // Shopify / PrestaShop / WooCommerce
  if (h.includes('cdn.shopify.com')) detected.cms = 'Shopify';
  else if (h.includes('/themes/classic/') || h.includes('PrestaShop')) detected.cms = 'PrestaShop';
  else if (h.includes('wp-content') || h.includes('woocommerce')) detected.cms = 'WordPress/WooCommerce';

  // Réseaux sociaux (liens dans le code)
  const socialPatterns = {
    instagram: /instagram\.com\/([A-Za-z0-9._]+)/,
    facebook: /facebook\.com\/([A-Za-z0-9.]+)/,
    linkedin: /linkedin\.com\/(company|in)\/([A-Za-z0-9-]+)/,
    youtube: /youtube\.com\/(channel|c|@)\/([A-Za-z0-9_-]+)/,
    tiktok: /tiktok\.com\/@([A-Za-z0-9._]+)/,
    twitter: /(?:twitter|x)\.com\/([A-Za-z0-9_]+)/,
    pinterest: /pinterest\.(com|fr)\/([A-Za-z0-9_]+)/,
  };
  detected.socialLinks = {};
  for (const [net, pattern] of Object.entries(socialPatterns)) {
    const m = h.match(pattern);
    if (m) detected.socialLinks[net] = m[0];
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

    // Route 1 : fetch HTML source + détection technologies (GRATUIT)
    if (body.action === 'fetch_source') {
      const targetUrl = body.url;
      if (!targetUrl) return { statusCode: 400, body: JSON.stringify({ error: 'url required' }) };
      try {
        const res = await fetch(targetUrl, {
          headers: { 'User-Agent': 'Mozilla/5.0 (compatible; ROAR-Audit/1.0; +https://roar.agency)' },
          signal: AbortSignal.timeout(8000)
        });
        const html = await res.text();
        const technologies = detectTechnologies(html);
        return {
          statusCode: 200,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
          body: JSON.stringify({ html: html.slice(0, 50000), technologies, status: res.status })
        };
      } catch (fetchErr) {
        return { statusCode: 200, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
          body: JSON.stringify({ html: '', technologies: {}, error: fetchErr.message }) };
      }
    }

    // Route 2 : appel Anthropic (comportement existant)
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
    return { statusCode: 200, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', 'X-RateLimit-Remaining': String(remaining) }, body: JSON.stringify(data) };

  } catch (err) {
    return { statusCode: 500, headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify({ error: err.message }) };
  }
};
