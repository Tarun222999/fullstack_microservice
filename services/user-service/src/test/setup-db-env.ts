process.env.NODE_ENV = 'test';
process.env.DOTENV_CONFIG_PATH = '.env.test';
process.env.INTERNAL_API_TOKEN ??= 'user-service-internal-token-123';
process.env.USER_DB_URL ??= 'postgresql://postgres:postgres@localhost:5432/user_service_test';
