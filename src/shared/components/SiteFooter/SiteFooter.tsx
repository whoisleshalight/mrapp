import { Fragment, useRef } from "react";
import { useLocation } from "react-router";
import { gsap, useGSAP } from "../../animation/gsap";
import { useAnimationReady } from "../../animation/readiness";
import Container from "../Container/Container";
import { site } from "../../config/site";
import styles from "./SiteFooter.module.scss";
import arrowIcon from "../../../../src/assets/icons/01.svg";
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
                        <img src={arrowIcon} alt="Arrow image" />
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
