import { NavLink, type NavLinkProps } from "react-router";
import styles from "./HeaderLink.module.scss";

type HeaderLinkProps = Omit<NavLinkProps, "children"> & {
    label: string;
};

export default function HeaderLink({
    to,
    label,
    end = to === "/",
    className,
    ...props
}: HeaderLinkProps) {
    return (
        <NavLink
            {...props}
            to={to}
            end={end}
            className={(state) =>
                [
                    styles.link,
                    state.isActive && styles.active,
                    typeof className === "function"
                        ? className(state)
                        : className,
                ]
                    .filter(Boolean)
                    .join(" ")
            }
        >
            {label}
        </NavLink>
    );
}
