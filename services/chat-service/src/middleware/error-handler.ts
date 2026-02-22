import { HttpError } from "@chatapp/common"
import type { ErrorRequestHandler } from "express"
import { logger } from "@/utils/logger"

export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
    if (err instanceof Error) {
        console.error(
            {
                err,
                errName: err.name,
                errMessage: err.message,
                errStack: err.stack
            },
            "Unhandled error occurred at chat-service"
        )
    } else {
        console.error({ err }, "Unhandled non-error thrown at chat-service")
    }

    const error = err instanceof HttpError ? err : undefined
    const statusCode = error?.statusCode ?? 500
    const message =
        statusCode >= 500
            ? "Internal server error"
            : (error?.message ?? "Unknown error")

    const payload = error?.details
        ? { message, details: error.details }
        : { message }

    res.status(statusCode).json(payload)

    void _next()
}