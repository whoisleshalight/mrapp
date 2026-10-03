import { useCallback, useEffect, useRef, type RefCallback } from "react";
import {
    ScrollSmoother,
    ScrollTrigger,
} from "../../shared/animation/gsap";
import { motion, prefersReducedMotion } from "../config/motion";

/** Creates ScrollSmoother before descendant layout effects create ScrollTriggers. */
export function useSmoothScroll() {
    const wrapper = useRef<HTMLDivElement | null>(null);
    const content = useRef<HTMLDivElement | null>(null);
    const smoother = useRef<ScrollSmoother | null>(null);

    const destroy = useCallback(() => {
        smoother.current?.kill();
        smoother.current = null;
    }, []);

    const sync = useCallback(() => {
        if (!wrapper.current || !content.current || prefersReducedMotion()) {
            destroy();
            return;
        }

        if (smoother.current) return;

        smoother.current = ScrollSmoother.create({
            wrapper: wrapper.current,
            content: content.current,
            smooth: motion.scrollSmoothing,
            smoothTouch: motion.touchScrollSmoothing,
            effects: true,
            ignoreMobileResize: true,
        });
        ScrollTrigger.refresh();
    }, [destroy]);

    const wrapperRef: RefCallback<HTMLDivElement> = useCallback(
        (node) => {
            wrapper.current = node;
            if (!node) destroy();
            else sync();
        },
        [destroy, sync],
    );

    const contentRef: RefCallback<HTMLDivElement> = useCallback(
        (node) => {
            content.current = node;
            if (!node) destroy();
            else sync();
        },
        [destroy, sync],
    );

    useEffect(() => {
        const reducedMotion = window.matchMedia(
            "(prefers-reduced-motion: reduce)",
        );
        const handlePreferenceChange = () => sync();

        sync();
        reducedMotion.addEventListener("change", handlePreferenceChange);

        return () => {
            reducedMotion.removeEventListener("change", handlePreferenceChange);
            destroy();
        };
    }, [destroy, sync]);

    return { wrapperRef, contentRef };
}
