import { Router } from "express"
import { authRouter } from "@/routes/auth.route"


export const registerRoutes = (app: Router) => {
    app.get("/health", (_req, res) => {
        res.status(200).json({
            status: 'ok',
            services: 'auth-service'
        })
    })

    app.use('/auth', authRouter)
}
