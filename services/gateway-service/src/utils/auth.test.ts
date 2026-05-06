import { describe, expect, it } from 'vitest';
import { HttpError } from '@chatapp/common';
import { getAuthenticatedUser } from '@/utils/auth';

describe('getAuthenticatedUser', () => {
  it('returns req.user when present', () => {
    const req = {
      user: {
        id: 'b7c7cebe-9554-49e2-90f8-7cd052de97fd',
        email: 'user@example.com',
      },
    } as any;

    const user = getAuthenticatedUser(req);

    expect(user.id).toBe('b7c7cebe-9554-49e2-90f8-7cd052de97fd');
    expect(user.email).toBe('user@example.com');
  });

  it('throws 401 when req.user is missing', () => {
    const req = {} as any;

    expect(() => getAuthenticatedUser(req)).toThrowError(HttpError);
    expect(() => getAuthenticatedUser(req)).toThrowError('Unauthorized');
  });
});
