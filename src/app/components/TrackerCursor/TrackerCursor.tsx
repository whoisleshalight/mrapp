import { useEffect, useId, useRef, useState } from "react";
import { getGlassBackdropFilter } from "@/shared/lib/glassBackdropFilter";
import { GlassDistortionFilter } from "@/shared/ui/GlassDistortionFilter/GlassDistortionFilter";
import {
    getFrameRatio,
    getSmoothingFactor,
} from "@/shared/animation/frameTiming";
import styles from "./TrackerCursor.module.scss";

type CursorMode = "project" | "showreel" | "details" | null;

export function TrackerCursor() {
    const filterId = `tracker-glass-${useId()}`;
    const backdropFilter = getGlassBackdropFilter(filterId);
    const cursorRef = useRef<HTMLDivElement>(null);
    const [mode, setMode] = useState<CursorMode>(null);
    const [labelMode, setLabelMode] =
        useState<Exclude<CursorMode, null>>("showreel");

    useEffect(() => {
        const cursor = cursorRef.current;
        if (!cursor) return;

        const reducedMotion = window.matchMedia(
            "(prefers-reduced-motion: reduce)",
        );
        let targetX = 0;
        let targetY = 0;
        let currentX = 0;
        let currentY = 0;
        let visible = false;
        let frame: number | null = null;
        let hoverFrame: number | null = null;
        let previousTime: number | null = null;
        let activeMode: CursorMode = null;

        const updateHover = (target: EventTarget | null) => {
            let nextMode: CursorMode = null;

            if (target instanceof Element) {
                if (
                    target.closest(
                        "[data-video-watch], [data-cursor='showreel']",
                    )
                ) {
                    nextMode = "showreel";
                } else if (
                    target.closest(
                        "[data-cursor='project']",
                    )
                ) {
                    nextMode = "project";
                } else if (target.closest("[data-cursor='details']")) {
                    nextMode = "details";
                }
            }

            if (nextMode !== activeMode) {
                activeMode = nextMode;
                setMode(nextMode);
                if (nextMode !== null) setLabelMode(nextMode);
            }
        };

        const updatePosition = () => {
            cursor.style.transform = `translate3d(${currentX}px, ${currentY}px, 0) translate(-50%, -50%)`;
        };

        const animate = (time: number) => {
            const frameRatio =
                previousTime === null ? 1 : getFrameRatio(time - previousTime);
            const smoothing = reducedMotion.matches
                ? 1
                : getSmoothingFactor(0.3, frameRatio);
            previousTime = time;
            currentX += (targetX - currentX) * smoothing;
            currentY += (targetY - currentY) * smoothing;

            if (Math.hypot(targetX - currentX, targetY - currentY) < 0.1) {
                currentX = targetX;
                currentY = targetY;
                frame = null;
            } else {
                frame = window.requestAnimationFrame(animate);
            }
            updatePosition();
        };

        const hide = () => {
            visible = false;
            updateHover(null);
            cursor.style.opacity = "0";
            cursor.style.removeProperty("will-change");
            if (frame !== null) window.cancelAnimationFrame(frame);
            frame = null;
            if (hoverFrame !== null) window.cancelAnimationFrame(hoverFrame);
            hoverFrame = null;
        };

        const handlePointerMove = (event: PointerEvent) => {
            if (event.pointerType !== "mouse") {
                hide();
                return;
            }

            targetX = event.clientX;
            targetY = event.clientY;
            if (!visible) {
                cursor.style.willChange = "transform";
                currentX = targetX;
                currentY = targetY;
                updatePosition();
                cursor.style.opacity = "1";
                visible = true;
            }
            if (frame === null) {
                previousTime = null;
                frame = window.requestAnimationFrame(animate);
            }
        };

        const handlePointerOver = (event: PointerEvent) => {
            if (event.pointerType === "mouse") updateHover(event.target);
        };
        const handlePointerOut = (event: PointerEvent) => {
            if (event.pointerType === "mouse") updateHover(event.relatedTarget);
        };
        const handleScroll = () => {
            if (!visible || hoverFrame !== null) return;
            hoverFrame = window.requestAnimationFrame(() => {
                hoverFrame = null;
                if (visible)
                    updateHover(document.elementFromPoint(targetX, targetY));
            });
        };

        window.addEventListener("pointermove", handlePointerMove);
        window.addEventListener("pointerover", handlePointerOver);
        window.addEventListener("pointerout", handlePointerOut);
        window.addEventListener("scroll", handleScroll, true);
        document.documentElement.addEventListener("pointerleave", hide);
        window.addEventListener("blur", hide);

        return () => {
            window.removeEventListener("pointermove", handlePointerMove);
            window.removeEventListener("pointerover", handlePointerOver);
            window.removeEventListener("pointerout", handlePointerOut);
            window.removeEventListener("scroll", handleScroll, true);
            document.documentElement.removeEventListener("pointerleave", hide);
            window.removeEventListener("blur", hide);
            hide();
        };
    }, []);

    return (
        <div
            ref={cursorRef}
            className={`${styles.tocoursore}${mode ? " active" : ""}`}
            aria-hidden="true"
        >
            <div className={styles.tocoursoreInner}>
                <div className={styles.glass}>
                    <GlassDistortionFilter
                        id={filterId}
                        className={styles.filters}
                    />
                    <div
                        className={styles.glassEffect}
                        style={{
                            backdropFilter,
                            WebkitBackdropFilter: backdropFilter,
                        }}
                    />
                    <div className={styles.glassTint} />
                    <div className={styles.glassShine} />
                </div>
                <span className={styles.tocoursoreCubeOne}></span>
                <span className={styles.tocoursoreCubeTwo}></span>
                <span className={styles.tocoursoreCubeThree}></span>
                <span className={styles.tocoursoreCubeFour}></span>
                <p className={styles.tocoursoreText}>
                    {labelMode === "details" ? (
                        "Details"
                    ) : labelMode === "project" ? (
                        <>
                            View <br /> Project
                        </>
                    ) : (
                        <>
                            Watch <br /> Showreel
                        </>
                    )}
                </p>
            </div>
        </div>
    );
}
