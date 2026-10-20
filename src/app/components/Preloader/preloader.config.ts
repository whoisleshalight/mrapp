export const preloader = {
    bands: [
        {
            text: `· LOADING · LOADING · LOADING · LOADING · LOADING ·`,
            fontSize: 120,
            fontWeight: 700,
            repetitions: 1,
            rotationSpeed: -0.3,
        },
        {
            text: "·  WEBSITES THAT CHANGES THE WORLD  ·",
            fontSize: 40,
            fontWeight: 600,
            repetitions: 3,
            rotationSpeed: -0.5,
        },
    ],
    entranceDuration: 2,
    exitDuration: 1,
    stagger: 0.12,
} as const;
