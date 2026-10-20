export function isSafari() {
    const userAgent = typeof navigator === "undefined" ? "" : navigator.userAgent;

    return (
        /Safari/i.test(userAgent) &&
        !/Chrome|Chromium|CriOS|Edg|OPR|OPiOS|FxiOS|Firefox|Android/i.test(userAgent)
    );
}
