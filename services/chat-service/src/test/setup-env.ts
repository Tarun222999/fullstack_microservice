process.env.NODE_ENV = 'test';
process.env.DOTENV_CONFIG_PATH = '.env.test';
process.env.CHAT_SERVICE_PORT ??= '4002';
process.env.INTERNAL_API_TOKEN ??= 'chat-service-internal-token-123456';
process.env.JWT_SECRET ??= 'chat-service-test-jwt-secret-1234567890';
process.env.RABBITMQ_URL ??= 'amqp://guest:guest@localhost:5672';
process.env.REDIS_URL ??= 'redis://localhost:6379';
process.env.MONGO_URL ??= 'http://localhost:27017/chat_test';
