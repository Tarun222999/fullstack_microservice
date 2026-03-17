import jwt from 'jsonwebtoken';
import { beforeEach, describe, expect, it } from 'vitest';
import { HttpError } from '@chatapp/common';

import { authenticateSocket } from '@/websocket/socket-auth';

describe('authenticateSocket', () => {
    beforeEach(() => {
        process.env.JWT_SECRET ??= 'chat-socket-test-secret-with-32-plus-chars';
    });

    it('accepts token from handshake auth payload', () => {
        const token = jwt.sign(
            { sub: '7af7345f-5419-47f1-b1a3-f25e31e0f1e4', email: 'user@example.com' },
            process.env.JWT_SECRET as string,
        );

        const user = authenticateSocket({
            handshake: {
                auth: { token },
                headers: {},
            },
        } as never);

        expect(user).toEqual({
            id: '7af7345f-5419-47f1-b1a3-f25e31e0f1e4',
            email: 'user@example.com',
        });
    });

    it('accepts bearer token from authorization header', () => {
        const token = jwt.sign(
            { sub: '7af7345f-5419-47f1-b1a3-f25e31e0f1e4' },
            process.env.JWT_SECRET as string,
        );

        const user = authenticateSocket({
            handshake: {
                auth: {},
                headers: {
                    authorization: `Bearer ${token}`,
                },
            },
        } as never);

        expect(user.id).toBe('7af7345f-5419-47f1-b1a3-f25e31e0f1e4');
    });

    it('rejects missing tokens', () => {
        expect(() =>
            authenticateSocket({
                handshake: {
                    auth: {},
                    headers: {},
                },
            } as never),
        ).toThrowError(HttpError);

        expect(() =>
            authenticateSocket({
                handshake: {
                    auth: {},
                    headers: {},
                },
            } as never),
        ).toThrow('Unauthorized');
    });

    it('rejects invalid tokens', () => {
        expect(() =>
            authenticateSocket({
                handshake: {
                    auth: { token: 'invalid-token' },
                    headers: {},
                },
            } as never),
        ).toThrow('Unauthorized');
    });
});
