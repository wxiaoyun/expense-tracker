export type TransactionSwipeAction = 'edit' | 'delete';

export function getTransactionSwipeAction(direction: 'left' | 'right'): TransactionSwipeAction {
  return direction === 'left' ? 'edit' : 'delete';
}
