import { ItemsView } from './items-view';

export const SalesPage = () => (
  <ItemsView
    config={{
      kind: 'sale',
      partyLabel: 'Customer',
      list: () => window.surya.sales.list(),
    }}
  />
);
