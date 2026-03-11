import "@/db/models/user.model";
import "@/db/models/outbox-event.model";
import "@/db/models/processed-event.model";

// Explicit bootstrap hook to register all Sequelize models before sync.
export const initModels = () => undefined;
