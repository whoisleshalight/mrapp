import { useRef } from "react";
import { usePixelImages } from "@/shared/animation/pixel-images/usePixelImages";
import type { Project } from "@/modules/projects/model/types";
import ProjectCard from "@/modules/projects/components/ProjectCard/ProjectCard";
import styles from "./ProjectGrid.module.scss";

export default function ProjectGrid({ items }: { items: Project[] }) {
    const root = useRef<HTMLDivElement>(null);
    usePixelImages(root);

    return (
        <div ref={root} className={styles.grid}>
            {items.map((project) => (
                <ProjectCard key={project.slug} project={project} />
            ))}
        </div>
    );
}
