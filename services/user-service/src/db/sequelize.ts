import { Sequelize } from "sequelize";

import { env } from "@/config/env";
import { logger } from "@/utils/logger";

export const sequelize = new Sequelize(env.USER_DB_URL, {
    dialect: "postgres",
    logging:
        env.NODE_ENV === "development" ? (msg: unknown) => {
            logger.debug({ sequelize: msg })
            console.error(msg);
        } : false,
    define: {
        underscored: true,
        freezeTableName: true
    }
})

export const connectToDatabase = async () => {
    await sequelize.authenticate()
    logger.info("User database connection established successfully")
}

export const initlializeDatabase = async () => {
    await connectToDatabase()

    const syncOptions = env.NODE_ENV === 'development' ? {} : { alter: true };
    await sequelize.sync(syncOptions);
    logger.info('Database sync');
}

export const closeDatabase = async () => {
    await sequelize.close()
    logger.info("User database connection closed")
}