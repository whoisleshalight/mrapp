import type { ComponentProps } from "react";
import lightArrowIcon from "@/shared/assets/icons/arrow-light.svg";
import darkArrowIcon from "@/shared/assets/icons/arrow-dark.svg";
import styles from "./AnimatedArrow.module.scss";

type Props = Omit<ComponentProps<"img">, "src"> & {
    variant?: "light" | "dark";
};

export default function AnimatedArrow({
    variant = "light",
    className = "",
    alt = "",
    ...props
}: Props) {
    return (
        <img
            {...props}
            src={variant === "dark" ? darkArrowIcon : lightArrowIcon}
            alt={alt}
            className={`${styles.arrow} ${className}`}
        />
    );
}
