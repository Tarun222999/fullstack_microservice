import type { Router } from 'express';
import { conversationRouter } from '@/routes/conversation.route';



export const registerRoutes = (app: Router) => {
    // Health check endpoint for Docker/K8s
    app.get('/health', (_req, res) => {
        res.status(200).json({ status: 'ok', service: 'chat-service' });
    });

    app.use('/conversations', conversationRouter);
};