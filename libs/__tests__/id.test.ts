import { createId } from '../id';

jest.mock('expo-crypto', () => ({
  randomUUID: () => '123e4567-e89b-42d3-a456-426614174000',
}));

describe('createId', () => {
  it('returns a random UUID without browser crypto globals', () => {
    expect(createId()).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
  });
});
