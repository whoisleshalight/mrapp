import type { Project } from "@/modules/projects/model/types";
import ProjectCard from "@/modules/projects/components/ProjectCard/ProjectCard";
import styles from "./ProjectGrid.module.scss";

export default function ProjectGrid({ items }: { items: Project[] }) {
    return (
        <div className={styles.grid}>
            {items.map((project) => (
                <ProjectCard key={project.slug} project={project} />
            ))}
        </div>
    );
}
