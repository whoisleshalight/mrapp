import motionTokens from '../../styles/motion.module.scss';

export const motion = {
    transitionDuration: Number(motionTokens.transitionDuration),
    preloaderDuration: 0.5,
    scrollSmoothing: 0.5,
    touchScrollSmoothing: 0.1,
    assetWaitTimeout: 8000,
    ease: "power3.inOut",
};

export function prefersReducedMotion() {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}
