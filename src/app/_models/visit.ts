export interface Visit {
    id: number;
    start_time: Date;
    ip: string;
    active_duration: number;
    os: string;
    city: string;
    country: string;
    actions_count: number;
}

export interface VisitStats {
    total_visits: number;
    unique_users: number;
    avg_duration: number;
    avg_active_duration: number;
    avg_actions: number;
}

