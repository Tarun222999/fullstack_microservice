process.env.NODE_ENV = 'test';
process.env.DOTENV_CONFIG_PATH = '.env.test';
delete process.env.GATEWAY__PORT;
process.env.AUTH_SERVICE_URL ??= 'http://auth-service.test';
process.env.USER_SERVICE_URL ??= 'http://user-service.test';
process.env.CHAT_SERVICE_URL ??= 'http://chat-service.test';
process.env.INTERNAL_API_TOKEN ??= 'internal-token-for-tests-12345';
process.env.JWT_SECRET ??= 'this-is-a-test-jwt-secret-with-32-chars';
