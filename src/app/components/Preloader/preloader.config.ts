import { site } from "@/shared/config/site";

export const preloader = {
    bands: [
        {
            text: `${site.name.toUpperCase()} · WEBSITES THAT CHANGES THE WORLD ·`,
            fontSize: 100,
            fontWeight: 600,
            repetitions: 1,
            rotationSpeed: -0.3,
        },
        {
            text: "WEB DESIGN · DEVELOPMENT  ·",
            fontSize: 32,
            fontWeight: 500,
            repetitions: 3,
            rotationSpeed: -0.5,
        },
    ],
    entranceDuration: 1.5,
    exitDuration: 0.8,
    stagger: 0.12,
    pointer: {
        strength: 0.6,
        response: 0.2,
        minWidth: 1100,
    },
} as const;
