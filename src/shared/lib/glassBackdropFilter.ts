import { isSafari } from "./isSafari";

export function getGlassBackdropFilter(filterId: string) {
    return isSafari() ? "blur(3px)" : `blur(3px) url("#${filterId}")`;
}
