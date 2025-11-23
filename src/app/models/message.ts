export interface Message {
    id: string;
    name: string;
    email: string;
    text: string;
    time: Date;
    unread: boolean;
    city: string;
    country: string;
}

export interface MessageRequest {
    name: string;
    email: string;
    text: string;
}

export interface List {
    messages: Message[];
    total: number;
}