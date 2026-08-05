/**
 * Bot / crawler detection
 *
 * A lightweight heuristic used to flag automated traffic so it can be excluded
 * from variant-serving and from rule-fire / score measurement (spec §6).
 *
 * Two signals, OR-combined:
 *   1. User-Agent pattern — matches the common crawler/preview/HTTP-client and
 *      AI-agent User-Agents.
 *   2. enrichment.isCloudProvider — datacenter/cloud IPs are a strong proxy for
 *      automation (real visitors browse from residential/mobile networks).
 *
 * Deliberately conservative on the UA side: an ABSENT User-Agent returns false
 * (unknown, not bot) so a real visitor with a stripped UA is never hidden from
 * personalization. The cloud-provider proxy still catches most headless traffic.
 */

/**
 * Substrings that identify automated User-Agents. Case-insensitive.
 * Covers search crawlers, social/preview fetchers, headless browsers, generic
 * HTTP clients, and AI agents.
 */
const BOT_UA_PATTERN =
  /bot\b|bot\/|crawl|spider|slurp|mediapartners|facebookexternalhit|embedly|quora link preview|showyoubot|outbrain|pinterest|slackbot|vkshare|w3c_validator|redditbot|applebot|whatsapp|flipboard|tumblr|bitlybot|skypeuripreview|nuzzel|discordbot|qwantify|bitrix|xing-contenttabreceiver|chrome-lighthouse|lighthouse|telegrambot|headless|phantomjs|puppeteer|playwright|python-requests|http-client|scrapy|curl\/|wget|axios\/|node-fetch|go-http|okhttp|java\/|libwww|gptbot|chatgpt|oai-searchbot|claudebot|anthropic|perplexity|ccbot|bytespider|amazonbot|semrush|ahrefs|dotbot|mj12bot|dataforseo|petalbot|yandex/i;

/**
 * True when the User-Agent looks like a bot/crawler.
 * Returns false for an absent User-Agent (unknown, not treated as a bot).
 */
export function isBotUserAgent(userAgent: string | null | undefined): boolean {
  if (!userAgent) return false;
  return BOT_UA_PATTERN.test(userAgent);
}

/**
 * Combined bot verdict from the User-Agent and the cloud-provider proxy.
 *
 * @param userAgent       Raw User-Agent header value (or null/undefined).
 * @param isCloudProvider enrichment.isCloudProvider (true when the IP resolves
 *                        to a datacenter/cloud network).
 */
export function detectIsBot(
  userAgent:       string | null | undefined,
  isCloudProvider: boolean | null | undefined,
): boolean {
  return isBotUserAgent(userAgent) || isCloudProvider === true;
}
