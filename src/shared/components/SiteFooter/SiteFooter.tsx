import Container from "../Container/Container";
import { site } from "../../config/site";
import styles from "./SiteFooter.module.scss";
import arrowIcon from "../../../../src/assets/icons/01.svg";
export default function SiteFooter() {
    return (
        <footer className={styles.footer}>
            <Container className={styles.container}>
                <div className="footer__body">
                    <div className="footer__title"></div>
                    <div className="footer__actions">
                        <img src={arrowIcon} alt="Arrow image" />
                        <a href={site.email}>{site.email}</a>
                        <ul>
                            <li>
                                <a href={site.instagramLink}>instagram</a>
                            </li>
                            <li>
                                <a href={site.upworkLink}>upwork</a>
                            </li>
                            <li>
                                <a href={site.telegramLink}>telegram</a>
                            </li>
                        </ul>
                    </div>
                </div>
                <p>
                    © Copyright {new Date().getFullYear()} {site.name} - create
                    with love
                </p>
            </Container>
        </footer>
    );
}
