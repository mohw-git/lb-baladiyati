import { excludeRecipientIds } from './notification-recipient.util';

describe('excludeRecipientIds', () => {
  it('removes users already notified in triage', () => {
    expect(excludeRecipientIds(['a', 'b', 'c'], ['b'])).toEqual(['a', 'c']);
  });

  it('returns empty when all candidates were already notified', () => {
    expect(excludeRecipientIds(['x'], ['x', 'y'])).toEqual([]);
  });
});
