export interface Item {
    title: string;
    text: string;
    src: string;
};

export const data: Item[] = [
    {
        title: "ABOUT.ARCH-BTN", text: "ABOUT.ARCH", src: 'assets/images/house.gif'
    },
    {
        title: "ABOUT.VIS-BTN",
        text: "ABOUT.VIS",
        src: 'assets/images/camera.gif'
    },
    {
        title: "ABOUT.PER-BTN", text: "ABOUT.PERS", src: 'assets/images/duck.gif'
    }
];