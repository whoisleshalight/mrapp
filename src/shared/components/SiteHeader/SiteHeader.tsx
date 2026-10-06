import { Link } from "react-router";
import Container from "../Container/Container";
import HeaderLink from "../HeaderLink/HeaderLink";
import { site } from "../../config/site";
import styles from "./SiteHeader.module.scss";

type SiteHeaderProps = {
    inert?: boolean;
    contactPage?: boolean;
};

export default function SiteHeader({ inert, contactPage }: SiteHeaderProps) {
    return (
        <header
            className={[styles.header, contactPage && styles.contactHeader].filter(Boolean).join(" ")}
            inert={inert}
            aria-busy={inert}
        >
            <Container>
                <div className={styles.inner}>
                    <div className={styles.header__left}>
                        <nav
                            aria-label="Main navigation"
                            className={styles.nav}
                        >
                            {site.navigation
                                .filter(({ to }) => to !== "/" && to !== "/contacts")
                                .map(({ to, label }) => (
                                    <HeaderLink key={to} to={to} label={label} />
                                ))}
                        </nav>
                    </div>
                    <div className={styles.header__center}>
                        <Link to="/" aria-label={`${site.name} — main`}>
                            {site.name} <span>®</span>
                        </Link>
                    </div>
                    <div className={styles.header__right}>
                        <HeaderLink
                            to={contactPage ? "/" : "/contacts"}
                            label={contactPage ? "Close ↗" : "Start Project"}
                            className={styles.brand}
                            aria-label={contactPage ? "Back to home" : `${site.name} — contacts`}
                        />
                    </div>
                </div>
            </Container>
        </header>
    );
}
