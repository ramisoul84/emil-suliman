import { AnimationOptions } from "ngx-lottie";

export interface Case {
    title: string;
    description: string;
    images: Slide[];
    link?: string;
    tags: string[];
}

export interface Slide {
    id: number;
    src?: string;
    options?: AnimationOptions,
    video?: string,
    bg?: string
}
