import { createApp } from "./app"
import { createServer } from "http"
import { env } from "@/config/env"
import { logger } from "@/utils/logger"
import { initModels } from "@/db/models"
import { closeDatabase, initlializeDatabase } from "@/db/sequelize"
import { startAuthEventConsumer, stopAuthEventConsume } from "@/messaging/auth-consumer"
import { closeMessaging, initMessaging, startOutboxPublisher, stopOutboxPublisher } from "@/messaging/event-publisher"


const main = async () => {
    try {
        initModels()
        await initlializeDatabase()
        await initMessaging();
        await startOutboxPublisher();
        await startAuthEventConsumer()
        const app = createApp()

        const server = createServer(app)

        const port = env.PORT ?? env.USER_SERVICE_PORT

        server.listen(port, () => {
            logger.info({ port }, 'User service is running')
        })

        const shutdown = async () => {
            logger.info("Shutting down User service")

            let hasErrors = false;
            await new Promise<void>((resolve) => {
                server.close(() => resolve());
            });

            try {
                await stopAuthEventConsume();
            } catch (error) {
                hasErrors = true;
                logger.error({ error }, "error during stopAuthEventConsume");
            }

            try {
                await stopOutboxPublisher();
            } catch (error) {
                hasErrors = true;
                logger.error({ error }, "error during stopOutboxPublisher");
            }

            try {
                await closeMessaging();
            } catch (error) {
                hasErrors = true;
                logger.error({ error }, "error during closeMessaging");
            }

            try {
                await closeDatabase();
            } catch (error) {
                hasErrors = true;
                logger.error({ error }, "error during closeDatabase");
            }

            process.exit(hasErrors ? 1 : 0);
        }


        process.on("SIGINT", () => {
            void shutdown()
        })
        process.on("SIGTERM", () => {
            void shutdown()
        })

    } catch (error) {

        logger.error({ error }, "Failed to start User service")
        process.exit(1)
    }
}

void main()
