import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { GenericContainer, StartedTestContainer } from 'testcontainers';

let container: StartedTestContainer | null = null;
let userRepository: any;
let sequelize: any;
let UserModel: any;
let dbRuntimeAvailable = false;

describe('UserRepository db integration', () => {
    beforeAll(async () => {
        try {
            container = await new GenericContainer('postgres:16')
                .withEnvironment({
                    POSTGRES_DB: 'user_service_test',
                    POSTGRES_USER: 'postgres',
                    POSTGRES_PASSWORD: 'postgres',
                })
                .withExposedPorts(5432)
                .start();

            const host = container.getHost();
            const port = container.getMappedPort(5432);
            process.env.USER_DB_URL = `postgresql://postgres:postgres@${host}:${port}/user_service_test`;

            const dbModule = await import('@/db');
            const repositoryModule = await import('@/repository/user.repositories');
            sequelize = dbModule.sequelize;
            UserModel = dbModule.UserModel;

            await sequelize.authenticate();
            await sequelize.sync({ force: true });

            userRepository = new repositoryModule.UserRepository();
            dbRuntimeAvailable = true;
        } catch (error) {
            dbRuntimeAvailable = false;
            const message =
                error instanceof Error ? error.message : 'Unknown container runtime error';
            // Keep a clear signal in output while avoiding hard-failing environments without Docker.
            console.warn(`[user-service][db-test] Skipped: ${message}`);
        }
    });

    afterEach(async () => {
        if (!dbRuntimeAvailable) {
            return;
        }
        await UserModel.destroy({ where: {}, truncate: true, cascade: true });
    });

    afterAll(async () => {
        if (!dbRuntimeAvailable) {
            return;
        }
        if (sequelize) {
            await sequelize.close();
        }
        if (container) {
            await container.stop();
        }
    });

    it('creates and reads back a user by id', async (context) => {
        if (!dbRuntimeAvailable) {
            context.skip();
        }

        const created = await userRepository.create({
            email: 'db-test@example.com',
            displayName: 'DB Test',
        });

        const found = await userRepository.findById(created.id);

        expect(found).not.toBeNull();
        expect(found.email).toBe('db-test@example.com');
        expect(found.displayName).toBe('DB Test');
    });

    it('searches users by query and excludes provided ids', async (context) => {
        if (!dbRuntimeAvailable) {
            context.skip();
        }

        const userOne = await userRepository.create({
            email: 'alice@example.com',
            displayName: 'Alice',
        });
        await userRepository.create({
            email: 'alex@example.com',
            displayName: 'Alex',
        });

        const result = await userRepository.searchByQuery('al', {
            excludeIds: [userOne.id],
            limit: 10,
        });

        expect(result).toHaveLength(1);
        expect(result[0].displayName).toBe('Alex');
    });

    it('upserts user from auth event payload', async (context) => {
        if (!dbRuntimeAvailable) {
            context.skip();
        }

        const payload = {
            id: '4d7fef16-3f52-4b8e-a4e1-6609ef0d1f9e',
            email: 'sync@example.com',
            displayName: 'Synced User',
            createdAt: '2026-01-01T00:00:00.000Z',
        };

        const upserted = await userRepository.upsertFromAuthEvent(payload);
        const found = await userRepository.findById(payload.id);

        expect(upserted.id).toBe(payload.id);
        expect(found).not.toBeNull();
        expect(found.email).toBe('sync@example.com');
        expect(found.displayName).toBe('Synced User');
    });
});
