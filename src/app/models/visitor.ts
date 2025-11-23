export interface Visitor {
    id: string;
    ip: string;
    user_agent: string;
    city: string;
    country: string;
    time: Date;
}

export interface Visitors {
    visitors: Visitor[];
    total: number;
    unique:number;
}

