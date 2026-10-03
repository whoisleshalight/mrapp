import { Outlet, ScrollRestoration, useLocation } from "react-router";
import { useEffect, useLayoutEffect, useRef } from "react";
import SiteHeader from "../../shared/components/SiteHeader/SiteHeader";
import SiteFooter from "../../shared/components/SiteFooter/SiteFooter";
import styles from "./SiteLayout.module.scss";
import PageTransition from "../components/PageTransition/PageTransition";
import { useAnimationReady } from "../../shared/animation/readiness";
import { useSmoothScroll } from "./useSmoothScroll";

export default function SiteLayout() {
    const { pathname } = useLocation();
    const ready = useAnimationReady();
    const mainRef = useRef<HTMLElement>(null);
    const headerRef = useRef<HTMLElement>(null);
    const previousPath = useRef(pathname);
    const { wrapperRef, contentRef } = useSmoothScroll();

    useLayoutEffect(() => {
        const header = headerRef.current;
        const main = mainRef.current;
        if (!header || !main) return;

        const updateHeaderHeight = () => {
            main.style.setProperty(
                "--site-header-height",
                `${header.getBoundingClientRect().height}px`,
            );
        };

        updateHeaderHeight();
        const observer = new ResizeObserver(updateHeaderHeight);
        observer.observe(header);
        return () => observer.disconnect();
    }, []);

    useEffect(() => {
        if (ready && previousPath.current !== pathname) {
            mainRef.current?.focus({ preventScroll: true });
            previousPath.current = pathname;
        }
    }, [pathname, ready]);

    return (
        <>
            <SiteHeader ref={headerRef} inert={!ready} />
            <div id="smooth-wrapper" ref={wrapperRef} className={styles.layout}>
                <div
                    id="smooth-content"
                    ref={contentRef}
                    className={styles.shell}
                    inert={!ready}
                    aria-busy={!ready}
                >
                    <main
                        id="main-content"
                        ref={mainRef}
                        tabIndex={-1}
                        className={styles.main}
                    >
                        <Outlet />
                    </main>
                    <SiteFooter />
                </div>
            </div>
            <ScrollRestoration />
            <PageTransition />
        </>
    );
}
