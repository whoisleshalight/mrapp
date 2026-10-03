import { Link, NavLink } from "react-router";
import Container from "../Container/Container";
import { site } from "../../config/site";
import styles from "./SiteHeader.module.scss";

export default function SiteHeader() {
    return (
        <header className={styles.header}>
            <Container>
                <div className={styles.inner}>
                    <Link
                        to="/"
                        className={styles.brand}
                        aria-label={`${site.name} — головна`}
                    >
                        {site.name}
                    </Link>
                    <nav aria-label="Головна навігація" className={styles.nav}>
                        {site.navigation.map(({ to, label }) => (
                            <NavLink
                                key={to}
                                to={to}
                                end={to === "/"}
                                className={({ isActive }) =>
                                    isActive ? styles.active : undefined
                                }
                            >
                                {label}
                            </NavLink>
                        ))}
                    </nav>
                </div>
            </Container>
        </header>
    );
}
