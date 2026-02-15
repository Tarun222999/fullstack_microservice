import { Router } from "express";
import { validateRequest } from "@chatapp/common";
import { loginHandler, registerHandler, revokeHandler, refreshHandler } from "@/controller/auth.controller";
import { loginSchema, refreshSchema, registerSchema, revokeSchema } from "@/routes/auth.schema";




export const authRouter: Router = Router()

authRouter.post('/register', validateRequest({ body: registerSchema.shape.body }), registerHandler)
authRouter.post('/login', validateRequest({ body: loginSchema.shape.body }), loginHandler);
authRouter.post('/refresh', validateRequest({ body: refreshSchema.shape.body }), refreshHandler);
authRouter.post('/revoke', validateRequest({ body: revokeSchema.shape.body }), revokeHandler);