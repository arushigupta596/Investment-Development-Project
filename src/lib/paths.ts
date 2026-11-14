/** Where each screen lives for IDO (/ido/...) versus a company CFO (/t/:tenantId/...). */
export function linksFor(tenantId: string, cfo: boolean) {
  const b = cfo ? `/t/${tenantId}` : '/ido'
  const co = cfo ? '' : `&company=${tenantId}`
  return {
    home: b,
    journey: `${b}/journey`,
    feeds: `${b}/data?tab=feeds${co}`,
    journals: `${b}/data?tab=journals${co}`,
    tb: `${b}/data?tab=tb${co}`,
    ledger: (account: string, month?: string) => `${b}/data?tab=ledger${co}&account=${account}${month ? `&month=${month}` : ''}`,
    financials: (view?: 'pl' | 'bs') => (cfo ? `${b}/financials${view ? `?view=${view}` : ''}` : `/ido/financials?company=${tenantId}${view ? `&view=${view}` : ''}`),
    assurance: cfo ? `${b}/assurance` : `/ido/assurance/${tenantId}`,
    reconciliations: `/t/${tenantId}/reconciliations`,
    exceptionsAged: cfo ? `${b}/exceptions?age=60%2B` : `/ido/exceptions?tenant=${tenantId}&age=60%2B`,
  }
}
