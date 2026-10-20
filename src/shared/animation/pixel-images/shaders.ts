export const vertexShader = `
  attribute vec2 position;
  varying vec2 uv;
  void main() {
    uv = vec2(position.x + 1.0, 1.0 - position.y) * 0.5;
    gl_Position = vec4(position, 0.0, 1.0);
  }
`

export const fragmentShader = `
  precision highp float;
  uniform sampler2D image;
  uniform sampler2D grid;
  uniform vec2 crop;
  uniform vec2 cropOrigin;
  uniform vec4 corners;
  uniform float overflow;
  uniform float displacement;
  uniform float maxOffset;
  uniform vec2 pixelSize;
  varying vec2 uv;

  void main() {
    vec4 encoded = floor(texture2D(grid, uv) * 255.0 + 0.5);
    // Native sampling stays untouched wherever the displacement field is at rest.
    if (encoded.r == 128.0 && encoded.g == 0.0 && encoded.b == 128.0 && encoded.a == 0.0) {
      gl_FragColor = vec4(0.0);
      return;
    }
    vec2 offset = (vec2(encoded.r * 256.0 + encoded.g, encoded.b * 256.0 + encoded.a) - 32768.0) / 32767.0 * maxOffset;
    // Inverse sampling makes the visible pixels follow the pointer's movement.
    vec2 source = uv * (1.0 + 2.0 * overflow) - overflow - offset * displacement;
    // Coverage avoids a dark, one-pixel frame when the bounded buffer is scaled.
    vec2 coverage = clamp(min(source, 1.0 - source) / pixelSize + 0.5, 0.0, 1.0);
    float mask = coverage.x * coverage.y;
    if (corners.x > 0.0) mask *= clamp((source.x / corners.x + source.y / corners.y - 1.0) / (pixelSize.x / corners.x + pixelSize.y / corners.y) + 0.5, 0.0, 1.0);
    if (corners.z > 0.0) mask *= clamp(((1.0 - source.x) / corners.z + (1.0 - source.y) / corners.w - 1.0) / (pixelSize.x / corners.z + pixelSize.y / corners.w) + 0.5, 0.0, 1.0);
    vec4 color = texture2D(image, clamp(cropOrigin + source * crop, 0.0, 1.0));
    gl_FragColor = vec4(color.rgb * color.a * mask, color.a * mask);
  }
`
