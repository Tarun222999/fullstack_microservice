import { createApp } from "./app"
import { createServer } from "http"
import { env } from "@/config/env"
import { logger } from "@/utils/logger"
import { closeDatabase, connectToDatabase } from "@/db/sequilize"
import { initModels } from "@/models"


const main = async () => {
    try {

        await connectToDatabase()
        await initModels()
        const app = createApp()

        const server = createServer(app)

        const port = env.AUTH_SERVICE_PORT

        server.listen(port, () => {
            logger.info({ port }, 'Auth service is running')
        })

        const shutdown = () => {
            logger.info("Shutting down auth service")

            Promise.all([closeDatabase()]).catch((error: unknown) => {
                logger.error({ error }, "error during shutdown tasks")
            })
                .finally(() => {
                    server.close(() => process.exit(0))
                })
        }


        process.on("SIGINT", shutdown)
        process.on("SIGTERM", shutdown)

    } catch (error) {

        logger.error({ error }, "Failed to start auth service")
        console.log(error)
        process.exit(1)
    }
}

void main()