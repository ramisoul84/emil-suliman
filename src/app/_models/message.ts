export interface Message {
    id: number;
    user_id: string;
    name: string;
    email: string;
    text: string;
    time: Date;
    unread: boolean;
    ip: string;
    city: string;
    country: string;
}

export interface MessageRequest {
    user_id?: string;
    name: string;
    email: string;
    text: string;
}

export interface MessageList {
    messages: Message[];
    total: number;
}