import { useState } from "react";
import styles from "./SiteCookies.module.scss";
import Container from "../Container/Container";

const COOKIE_CONSENT_KEY = "siteCookiesAccepted";

export default function SiteCookies() {
    const [visibility, setVisibility] = useState<"visible" | "closing" | "hidden">(() => {
        try {
            return localStorage.getItem(COOKIE_CONSENT_KEY) === "true"
                ? "hidden"
                : "visible";
        } catch {
            return "visible";
        }
    });

    const acceptCookies = () => {
        try {
            localStorage.setItem(COOKIE_CONSENT_KEY, "true");
        } catch {
            // Still dismiss the banner when browser storage is unavailable.
        }

        setVisibility("closing");
    };

    if (visibility === "hidden") return null;

    return (
        <div
            className={`${styles.cookies}${visibility === "closing" ? ` ${styles.cookiesClosing}` : ""}`}
            onTransitionEnd={(event) => {
                if (
                    visibility === "closing" &&
                    event.target === event.currentTarget &&
                    event.propertyName === "opacity"
                ) {
                    setVisibility("hidden");
                }
            }}
        >
            <Container>
                <div className={styles.cookies__inner}>
                    <p className={styles.cookies__info}>
                        We use cookies on our website to provide you with the
                        most relevant experience by remembering your preferences
                        and repeat visits.
                    </p>
                    <button
                        type="button"
                        className={styles.cookies__btn}
                        onClick={acceptCookies}
                        disabled={visibility === "closing"}
                    >
                        OK
                    </button>
                </div>
            </Container>
        </div>
    );
}
