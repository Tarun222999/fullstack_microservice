import { Router } from "express";
import { validateRequest } from "@chatapp/common";
import { registerHandler } from "@/controller/auth.controller";
import { registerSchema } from "@/routes/auth.schema";




export const authRouter: Router = Router()

authRouter.post('/register', validateRequest({
    body: registerSchema.shape.body
}), registerHandler)