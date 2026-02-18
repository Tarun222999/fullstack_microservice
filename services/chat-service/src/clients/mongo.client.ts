import { MongoClient } from "mongodb";

import { env } from "@/config/env";
import { logger } from "@/utils/logger";

let client: MongoClient | null = null;

export const getMongoClient = async (): Promise<MongoClient> => {
    if (client) {
        return client;
    }
    const mongoUrl = env.MONGO_URL
    client = new MongoClient(mongoUrl)
    await client.connect()
    logger.info('Mongodb connection established')

    return client
}

export const closeMongoClient = async () => {
    if (!client) {
        return
    }
    await client.close()
    logger.info('Mongodb COnnection Closed')
    client = null
}
