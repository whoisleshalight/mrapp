import Container from "../../../../shared/components/Container/Container";

import styles from "./HomeHero.module.scss";

export default function HomeHero() {
    return (
        <section className={styles.hero} aria-labelledby="home-title">
            <Container>
                <div className={styles.inner}>
                    <div className={styles.title}>
                        Lorem ipsum <br /> dolor sit amet.
                    </div>
                    <div className={styles.pictures}></div>
                </div>
            </Container>
        </section>
    );
}
