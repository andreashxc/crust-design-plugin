/**
 * Minimal Chrome match-pattern matcher.
 * Spec: https://developer.chrome.com/docs/extensions/develop/concepts/match-patterns
 *
 * Phase 1 supports:
 *   - scheme: '*' (http or https), 'http', 'https', 'file'
 *   - host: literal | '*.<domain>' (subdomain wildcard) | '*' (any host)
 *   - path: glob with '*' wildcard
 *
 * Per RESEARCH R6: '*://*.ya.ru/*' does NOT match the apex 'ya.ru' — both
 * '*://ya.ru/*' and '*://*.ya.ru/*' are required to scope to apex + subdomains.
 *
 * Regex fallback (`scope.regex`) is Phase 3 (MAN-02) — NOT implemented here.
 */

export function matchesUrl(url: string, patterns: string[]): boolean {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  for (const pattern of patterns) {
    if (matchOne(parsed, pattern)) return true;
  }
  return false;
}

function matchOne(url: URL, pattern: string): boolean {
  // Pattern format: <scheme>://<host>/<path>
  const schemeIdx = pattern.indexOf('://');
  if (schemeIdx < 0) return false;
  const scheme = pattern.slice(0, schemeIdx);
  const rest = pattern.slice(schemeIdx + 3);
  const slashIdx = rest.indexOf('/');
  if (slashIdx < 0) return false;
  const host = rest.slice(0, slashIdx);
  const path = rest.slice(slashIdx); // includes leading '/'

  if (!matchScheme(scheme, url.protocol)) return false;
  if (!matchHost(host, url.hostname)) return false;
  if (!matchPath(path, url.pathname + url.search)) return false;
  return true;
}

function matchScheme(pattern: string, urlProtocol: string): boolean {
  // url.protocol includes trailing colon, e.g. 'https:'
  const urlScheme = urlProtocol.replace(/:$/, '');
  if (pattern === '*') return urlScheme === 'http' || urlScheme === 'https';
  return pattern === urlScheme;
}

function matchHost(pattern: string, urlHost: string): boolean {
  if (pattern === '*') return true;
  if (pattern.startsWith('*.')) {
    const suffix = pattern.slice(2); // 'ya.ru' from '*.ya.ru'
    // Subdomain pattern matches host = something.<suffix>, NOT the apex itself (RESEARCH R6).
    return urlHost.endsWith(`.${suffix}`);
  }
  return pattern === urlHost;
}

function matchPath(pattern: string, urlPath: string): boolean {
  // Convert glob ('*' = any chars) to regex.
  const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*');
  const re = new RegExp(`^${escaped}$`);
  return re.test(urlPath);
}
