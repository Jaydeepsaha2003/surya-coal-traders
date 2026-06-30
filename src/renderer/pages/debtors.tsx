import { LedgerView } from './ledger-view';

export const DebtorsPage = () => (
  <LedgerView
    config={{
      kind: 'debtor',
      partyType: 'customer',
      totalLabel: 'Total Debtors',
      oldestLabel: 'Oldest Invoice',
      actionLabel: 'Add Receipt',
      add: (input) => window.surya.ledger.addReceipt(input),
      summary: () => window.surya.ledger.debtorsSummary(),
      aging: () => window.surya.ledger.debtorsAging(),
    }}
  />
);
