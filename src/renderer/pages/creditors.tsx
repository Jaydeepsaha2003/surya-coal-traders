import { LedgerView } from './ledger-view';

export const CreditorsPage = () => (
  <LedgerView
    config={{
      kind: 'creditor',
      partyType: 'supplier',
      totalLabel: 'Total Creditors',
      oldestLabel: 'Oldest Bill',
      actionLabel: 'Add Payment',
      add: (input) => window.surya.ledger.addPayment(input),
      summary: () => window.surya.ledger.creditorsSummary(),
      aging: () => window.surya.ledger.creditorsAging(),
    }}
  />
);
