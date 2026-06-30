import { ItemsView } from './items-view';

export const PurchasesPage = () => (
  <ItemsView
    config={{
      kind: 'purchase',
      partyLabel: 'Supplier',
      list: () => window.surya.purchases.list(),
    }}
  />
);
