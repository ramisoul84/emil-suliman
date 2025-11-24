export interface Visitor {
    id: string;
    ip: string;
    os: string;
    city: string;
    country: string;
    time: Date;
}

export interface Visitors {
    visitors: Visitor[];
    total: number;
    unique:number;
}

