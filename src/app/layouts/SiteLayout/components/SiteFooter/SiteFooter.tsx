import { Fragment, useRef } from "react";
import { useLocation } from "react-router";
import { gsap, useGSAP } from "@/shared/animation/gsap";
import { useAnimationReady } from "@/shared/animation/readiness";
import Container from "@/shared/ui/Container/Container";
import AnimatedArrow from "@/shared/ui/AnimatedArrow/AnimatedArrow";
import { site } from "@/shared/config/site";
import styles from "./SiteFooter.module.scss";
export default function SiteFooter() {
    const footerRef = useRef<HTMLElement>(null);
    const { pathname } = useLocation();
    const ready = useAnimationReady();

    useGSAP(
        () => {
            if (!ready || !footerRef.current) return;

            gsap.to(document.body, {
                backgroundColor: "#000",
                ease: "none",
                scrollTrigger: {
                    trigger: footerRef.current,
                    // Fade from 10% to 90% of the footer entering the viewport.
                    start: "10% bottom",
                    end: "90% bottom",
                    scrub: true,
                    invalidateOnRefresh: true,
                },
            });
        },
        { scope: footerRef, dependencies: [pathname, ready], revertOnUpdate: true },
    );

    return (
        <footer ref={footerRef} className={styles.footer}>
            <Container className={styles.container}>
                <div className={styles.footer__body}>
                    <div className={styles.footer__title}>
                        lets work <br /> together!
                    </div>
                    <div className={styles.footer__actions}>
                        <AnimatedArrow className={styles.footer__arrow} />
                        <a href={site.email}>{site.email}</a>
                        <ul>
                            {site.social.map(({ href, label }, index) => (
                                <Fragment key={label}>
                                    {index > 0 && <li aria-hidden="true">-</li>}
                                    <li>
                                        <a href={href}>{label}</a>
                                    </li>
                                </Fragment>
                            ))}
                        </ul>
                    </div>
                </div>
                <p>
                    © {new Date().getFullYear()} All Right reserved {site.name}{" "}
                    - create with love!
                </p>
            </Container>
        </footer>
    );
}
