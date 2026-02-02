import { sequelize } from "@/db/sequilize";
import { UserCredentials } from "@/models";
import { RegisterInput } from "@/types/auth";
import { HttpError } from "@chatapp/common";
import { Op } from "sequelize";



export const register = async (input: RegisterInput) => {
    const existing = await UserCredentials.findOne({
        where: { email: { [Op.eq]: input.email } }
    })

    if (existing) {
        throw new HttpError(409, "User with this email already exists")
    }

    const transaction = await sequelize.transaction()
    try {

    } catch (error) {
        await transaction.rollback()
        throw error
    }
}