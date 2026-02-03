import { z } from "@chatapp/common"

export const registerSchema = z.object({
    body: z.object({
        email: z.string().email(),
        password: z.string().min(8),
        displayName: z.string().min(3).max(30)
    })
})