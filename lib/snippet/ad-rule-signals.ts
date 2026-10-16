/**
 * Consent-gated signal reads for the advertiser rule-ad decision context.
 *
 * The rule-ad branch of the decide route seeds buildDecisionContext with the
 * visitor's behavioural history and the tenant's GA4 history. History is
 * personalization data and GA4 is analytics data, so each read only runs with
 * its own consent category (mirroring the audience fetch, which is gated on
 * personalization). A denied or failing read yields its empty value, so the
 * rule context still builds on the anonymous signals.
 */

export interface AdRuleSignalsInput<H, G> {
  personalization: boolean;
  analytics:       boolean;
  loadHistory:     () => Promise<H>;
  emptyHistory:    () => H;
  loadGa4:         () => Promise<G>;
  emptyGa4:        () => G;
}

export async function loadAdRuleSignals<H, G>(input: AdRuleSignalsInput<H, G>): Promise<[H, G]> {
  return Promise.all([
    input.personalization
      ? input.loadHistory().catch(() => input.emptyHistory())
      : Promise.resolve(input.emptyHistory()),
    input.analytics
      ? input.loadGa4().catch(() => input.emptyGa4())
      : Promise.resolve(input.emptyGa4()),
  ]);
}
