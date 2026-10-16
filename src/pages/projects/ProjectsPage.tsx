import Container from "@/shared/ui/Container/Container";
import ProjectGrid from "@/modules/projects/components/ProjectGrid/ProjectGrid";
import { projects } from "@/modules/projects/data/projects";
import styles from "./ProjectsPage.module.scss";
import AnimatedArrow from "@/shared/ui/AnimatedArrow/AnimatedArrow";

export default function ProjectsPage() {
    return (
        <Container>
            <section
                className={styles.section}
                aria-labelledby="projects-title"
            >
                <div className={styles.heading}>
                    <div className={styles.box}>
                        <h1 id="projects-title">Projects</h1>
                        <p>A selection of our projects.</p>
                    </div>
                    <div className={styles.action}>
                        <AnimatedArrow variant="dark" />
                    </div>
                </div>
                <ProjectGrid items={projects} />
            </section>
        </Container>
    );
}
