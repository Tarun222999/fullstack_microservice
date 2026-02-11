export interface User {
    id: string;
    email: string;
    displayName: string;
    createdAt: Date;
    updatedAt: Date
}

export interface CreateUserInput {
    email: string;
    displayName: string;
}