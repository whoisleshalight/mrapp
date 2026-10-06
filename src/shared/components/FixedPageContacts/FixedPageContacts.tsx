import { Fragment } from "react";
import styles from "./FixedPageContacts.module.scss";
import Container from "../Container/Container";
import { site } from "../../config/site";

export default function FixedPageContacts() {
    return (
        <div className={styles.bottom}>
            <Container>
                <div className={styles.bottom__inner}>
                    <a href={site.email}>{site.email}</a>
                    <ul className={styles.list}>
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
            </Container>
        </div>
    );
}
