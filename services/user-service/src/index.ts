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

        const shutdown = () => {
            logger.info("Shutting down User service")

            Promise.all([stopAuthEventConsume(), stopOutboxPublisher(), closeMessaging(), closeDatabase()]).catch((error: unknown) => {
                logger.error({ error }, "error during shutdown tasks")
            })
                .finally(() => {
                    server.close(() => process.exit(0))
                })
        }


        process.on("SIGINT", shutdown)
        process.on("SIGTERM", shutdown)

    } catch (error) {

        logger.error({ error }, "Failed to start User service")
        process.exit(1)
    }
}

void main()
