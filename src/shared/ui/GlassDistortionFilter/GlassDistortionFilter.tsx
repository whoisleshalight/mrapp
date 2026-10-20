type GlassDistortionFilterProps = {
    id: string;
    className?: string;
};

export function GlassDistortionFilter({ id, className }: GlassDistortionFilterProps) {
    return (
        <svg className={className} xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">
            <defs>
                <filter id={id} x="0%" y="0%" width="100%" height="100%" filterUnits="objectBoundingBox">
                    <feTurbulence type="fractalNoise" baseFrequency="0.01 0.01" numOctaves="1" seed="5" result="turbulence" />
                    <feGaussianBlur in="turbulence" stdDeviation="3" result="softMap" />
                    <feDisplacementMap in="SourceGraphic" in2="softMap" scale="150" xChannelSelector="R" yChannelSelector="G" />
                </filter>
            </defs>
        </svg>
    );
}
