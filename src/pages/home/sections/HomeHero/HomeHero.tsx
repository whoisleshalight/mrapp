import Container from "../../../../shared/components/Container/Container";

import styles from "./HomeHero.module.scss";

export default function HomeHero() {
    return (
        <section
            className={styles.hero}
            aria-labelledby="home-title"
        >
            <Container>saas</Container>
        </section>
    );
}
