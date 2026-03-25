export interface User {
    id: string;
    email: string;
    displayName: string;
    createdAt: Date;
    updatedAt: Date
}

export interface UserSummary {
    id: string;
    displayName: string;
}

export interface CreateUserInput {
    email: string;
    displayName: string;
}

export interface GetUsersByIdsInput {
    ids: string[];
}
