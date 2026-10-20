/** Cursor response and fixed resource budgets, independent of the scroll reveal. */
export const pixelConfig = {
    gridSize: 8,
    mouseRadius: 1.75,
    strength: 1,
    relaxation: 0.92,
    displacement: 1.4,
    velocityDecay: 0.3,
    motionSpeed: 0.9,
    // Transparent margin for pixels displaced beyond the photo's edges.
    overflow: 0.3,
    maxOffset: 0.35,
    // Fixed budgets also apply to Retina and very large desktop screens.
    maxRenderPixels: 800_000,
    maxTextureSide: 1536,
    // A hovered photo and an outgoing photo can animate independently.
    maxRenderers: 2,
} as const;
