import { Outlet, ScrollRestoration, useLocation } from "react-router";
import { useEffect, useRef } from "react";
import SiteHeader from "../../shared/components/SiteHeader/SiteHeader";
import SiteCookies from "../../shared/components/SiteCookies/SiteCookies";
import SiteFooter from "../../shared/components/SiteFooter/SiteFooter";
import FixedPageContacts from "../../shared/components/FixedPageContacts/FixedPageContacts";
import styles from "./SiteLayout.module.scss";
import PageTransition from "../components/PageTransition/PageTransition";
import { useAnimationReady } from "../../shared/animation/readiness";
import { useSmoothScroll } from "./useSmoothScroll";

export default function SiteLayout() {
    const { pathname } = useLocation();
    const isContactPage = /^\/contacts?\/?$/i.test(pathname);
    const ready = useAnimationReady();
    const mainRef = useRef<HTMLElement>(null);
    const previousPath = useRef(pathname);
    const { wrapperRef, contentRef } = useSmoothScroll();

    useEffect(() => {
        if (ready && previousPath.current !== pathname) {
            mainRef.current?.focus({ preventScroll: true });
            previousPath.current = pathname;
        }
    }, [pathname, ready]);

    return (
        <>
            <SiteHeader inert={!ready} contactPage={isContactPage} />
            {!isContactPage && <SiteCookies></SiteCookies>}
            {!isContactPage && <FixedPageContacts />}
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
                    {!isContactPage && <SiteFooter />}
                </div>
            </div>
            <ScrollRestoration />
            <PageTransition />
        </>
    );
}
