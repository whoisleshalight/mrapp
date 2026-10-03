import Container from "../Container/Container";
import { site } from "../../config/site";
import styles from "./SiteFooter.module.scss";
import arrowIcon from "../../../../src/assets/icons/01.svg";
export default function SiteFooter() {
    return (
        <footer className={styles.footer}>
            <Container className={styles.container}>
                <div className={styles.footer__body}>
                    <div className={styles.footer__title}>
                        lets work <br /> together!
                    </div>
                    <div className={styles.footer__actions}>
                        <img src={arrowIcon} alt="Arrow image" />
                        <a href={site.email}>{site.email}</a>
                        <ul>
                            <li>
                                <a href={site.instagramLink}>Instagram</a>
                            </li>
                            <li>-</li>
                            <li>
                                <a href={site.upworkLink}>Upwork</a>
                            </li>
                            <li>-</li>
                            <li>
                                <a href={site.telegramLink}>Telegram</a>
                            </li>
                        </ul>
                    </div>
                </div>
                <p>
                    © {new Date().getFullYear()} All Right Copyright {site.name}{" "}
                    - create with love!
                </p>
            </Container>
        </footer>
    );
}
