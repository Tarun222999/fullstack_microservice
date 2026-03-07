process.env.NODE_ENV = 'test';
process.env.DOTENV_CONFIG_PATH = '.env.test';
process.env.INTERNAL_API_TOKEN ??= 'chat-db-test-internal-token-123';
process.env.JWT_SECRET ??= 'chat-db-test-jwt-secret-32-characters';
process.env.RABBITMQ_URL ??= 'amqp://guest:guest@localhost:5672';
process.env.MONGO_URL ??= 'mongodb://localhost:27017/chat_service_test';
process.env.REDIS_URL ??= 'redis://localhost:6379';
