import { Slide } from "../../components/slider/slider.component";

interface Case {
    title: string;
    description: string;
    images: Slide[];
}


export const data: Case[] = [
    {
        title: "WAHA",
        description: "In the heart of the Syrian desert, this viewing platform celebrates the hidden vitality of the landscape. Inspired by Palmyra’s beehive houses, its domed forms—built from fired mud bricks—combine natural beauty with strong thermal performance. Water and greenery create a cool refuge where travelers can pause and take in the vast horizon.</br/>A steel-and-clay canopy hovers above the terrace, blending ancient craftsmanship with modern design. It conveys authenticity and lightness. More than a viewpoint, the project stands as a symbol of resilience—a landmark reimagining the desert as a place of renewal and helping revive Syria’s tourism, culture, and hope after years of conflict<br/></br><strong>Role:</strong> Design and visualisation",
        images: [
            {
                id: 0,
                options: {
                    path: '/assets/animations/waha.json',
                    autoplay: true,
                    loop: true
                },
                bg:"white"
            },
            {
                id: 1,
                src: 'assets/projects/1/1.jpg',
            },
            {
                id: 2,
                src: 'assets/projects/1/2.jpg',
            },
            {
                id: 3,
                src: 'assets/projects/1/3.jpg',
            },
            {
                id: 4,
                src: 'assets/projects/1/4.jpg',
            }
        ]
    },
    {
        title: "SWSG Social housing",
        description: "In Stuttgart, this social housing project introduces a new approach to affordable living. Built from prefabricated wooden modules, it offers sustainable, high-quality homes for people with limited income. The modular system allows rapid construction, reducing costs and environmental impact while creating warm, livable spaces. Designed with practicality and community in mind, it provides a simple, efficient response to the city’s growing housing needs.<br/><br/><strong>Project by:</strong> Werner Sobek AG, Aktivhaus GmbH<br/><strong>Role:</strong> visualisation, facade design ",
        images: [
            {
                id: 1,
                src: 'assets/projects/2/1.jpg',
            },
            {
                id: 2,
                src: 'assets/projects/2/2.jpg',
            },
            {
                id: 3,
                src: 'assets/projects/2/3.jpg',
            }
        ]
    },
    {
        title: "THE INNER LOOP",
        description: "At EXPO 2020 Dubai, the inner loop served as the main pedestrian path that needed shading from the intense desert sun while maintaining an engaging visual identity. Originally proposed by SWA Design in Los Angeles, the concept of a flock of birds was developed and executed by our team.<br/><br/>The installation includes 3,370 aluminum birds in three sizes, distributed across ten canopies to evoke a migrating flock. Designed for shading, durability, and lightness, the birds were arranged in two layers to create dynamic, shifting patterns of shadow throughout the day.<br/><br/>The project became a distinctive feature of the EXPO site. My role included developing the bird forms, optimizing their distribution, and supervising the technical design and implementation.<br/><br/><strong>Project by:</strong> Werner Sobek AG,<br/><strong>Role:</strong> Design and visualisation",
        images: [
            {
                id: 0,
                options: {
                    path: '/assets/animations/birds.json',
                    autoplay: true,
                    loop: true
                },
                 bg:"white"
            },
            {
                id: 1,
                src: 'assets/projects/3/1.jpg',
            },
            {
                id: 2,
                src: 'assets/projects/3/2.jpg',
            },
            {
                id: 3,
                src: 'assets/projects/3/3.jpg',
            },
            {
                id: 4,
                src: 'assets/projects/3/4.jpg',
            }
        ]
    },
    {
        title: "TWIN HOUSE",
        description: "Two identical residential homes share a common backyard, designed for two families on a narrow, elongated plot typical of rural Germany. The project makes optimal use of limited land, fitting seamlessly into its surroundings while maintaining comfort and functionality.<br/><br/>Each house is compact yet complete, offering all the essentials of family living within just a few meters of width. Spread across three floors and topped with a private terrace, the design maximizes space, light, and connection to the outdoors—proving that thoughtful architecture can thrive even on the smallest sites.<br/><br/><strong>Project by:</strong>: pfalzarchitekt-reiter<br/><strong>Role:</strong> Design and visualisation",
        images: [
            {
                id: 1,
                src: 'assets/projects/4/1.jpg',
            },
            {
                id: 2,
                src: 'assets/projects/4/2.jpg',
            }
        ]
    },
    {
        title: "ISENBURG ZENTRUM",
        description: "This project envisions the transformation of a declining mall in Isenburg into a vibrant mixed-use development combining retail, hospitality, and services. The design reimagines the existing courtyard and façades, giving the complex a renewed identity and stronger connection to its surroundings. By introducing a hotel and activating public spaces, the project seeks to bring new life, character, and purpose to a site once defined by decline.<br/><br/><strong>Project by:</strong> Leonard design architects<br/><strong>Role:</strong> Facade Design and visualisation",
        images: [
            {
                id: 1,
                src: 'assets/projects/5/1.jpg',
            }
        ]
    },
    {
        title: "Nottingham Student Dormitory",
        description: "This dormitory is proposed above an existing parking lot near the train station, responding to the growing demand for student housing. The design makes efficient use of limited urban space while creating a lively and comfortable environment for residents. Its façade is conceived to stand out—bold and expressive—bringing a distinctive identity to the area and rethinking what student accommodation can look like.<br/><br/><strong>Project by:</strong> Leonard design architects<br/><strong>Role:</strong> Facade Design and visualisation",
        images: [
            {
                id: 1,
                src: 'assets/projects/6/1.jpg',
            }
        ]
    },
    {
        title: "NORDIC HUTS",
        description: "Set in the scenic mountains of Norway, this project explores the country’s deep tradition of mountain huts—places where Norwegians retreat to enjoy nature and calm. Based on the same design principles, two distinct versions were developed: one rooted in local vernacular forms, the other expressing a contemporary language with expansive glazing that opens to the surrounding landscape. Both maintain a sense of warmth, comfort, and belonging, blending naturally into their mountain setting.",
        images: [
            {
                id: 1,
                src: 'assets/projects/7/1.jpg',
            },
            {
                id: 2,
                src: 'assets/projects/7/2.jpg',
            },
            {
                id: 3,
                src: 'assets/projects/7/3.jpg',
            }
        ]
    },
    {
        title: "WOLKENREICH",
        description: "On the third floor of Experimenta Heilbronn, an interactive installation composed of 85 kinetic elements was proposed. Each unit moves independently yet functions as part of a coordinated whole, responding to visitors’ movements and forming dynamic, ever-changing shapes.<br/><br/>Originally developed with researchers from the University of Stuttgart, Wolkenreich was designed for exhibitions and trade fairs. Its suspended folding structures open and close through a precise motion system driven by small electric motors, allowing complex choreographies and programmed scenarios. My role involved designing the interactive sequences and creating the visual content in collaboration with a colleague.<br/><br/><strong>Project by:</strong> Werner Sobek AG<br/><strong>Role:</strong> Design and visualisation",
        images: [
            {
                id: 1,
                src: 'assets/projects/8/1.jpg',
            },
            {
                id: 2,
                src: 'assets/projects/8/2.jpg',
            },
            {
                id: 3,
                src: 'assets/projects/8/3.jpg',
            }
        ]
    },
    {
        title: "Poole thistle seafront ",
        description: "This project focuses on the redesign of several key buildings, including a hotel, residential complex, and tower, to redefine the city’s image and strengthen its role as a growing tourist destination. Through updated architecture and cohesive urban identity, the development aims to bring new energy, character, and visibility to the area.<br/><br/><strong>Project by:</strong> Leonard design architects<br/<strong>Role:</strong> Visualisation",
        images: [
            {
                id: 1,
                src: 'assets/projects/9/1.jpg',
            },
        ]
    },
]