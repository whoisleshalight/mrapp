import type { PropsWithChildren } from "react";
import styles from "./Container.module.scss";
type Props = PropsWithChildren<{ className?: string }>;

export default function Container({ children, className = "" }: Props) {
    return <div className={`${styles.container} ${className}`}>{children}</div>;
}
