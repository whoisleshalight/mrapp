import { useRef } from "react";
import Container from "@/shared/ui/Container/Container";
import HeroSpecialties from "./HeroSpecialties/HeroSpecialties";

import styles from "./HomeHero.module.scss";

export default function HomeHero() {
    const hero = useRef<HTMLElement>(null);

    return (
        <section ref={hero} className={styles.hero} aria-labelledby="home-title">
            <Container>
                <div className={styles.inner}>
                    <h1 id="home-title" className={styles.title}>
                        Lorem ipsum <br /> dolor sit amet.
                    </h1>
                </div>
                <HeroSpecialties hero={hero} />
            </Container>
        </section>
    );
}
