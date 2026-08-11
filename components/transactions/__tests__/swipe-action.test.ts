import { getTransactionSwipeAction } from '../swipe-action';

describe('getTransactionSwipeAction', () => {
  it('edits when swiping left to reveal the right action', () => {
    expect(getTransactionSwipeAction('left')).toBe('edit');
  });

  it('deletes when swiping right to reveal the left action', () => {
    expect(getTransactionSwipeAction('right')).toBe('delete');
  });
});
