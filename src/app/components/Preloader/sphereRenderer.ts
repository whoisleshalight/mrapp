import { preloader } from "./preloader.config";

export type SpherePose = { upper: number; lower: number };
export type SphereOrbit = { yaw: number; pitch: number };

const vertexSource = `
  attribute vec3 position;
  attribute vec2 uv;
  uniform float spin;
  uniform float offset;
  uniform float time;
  uniform vec2 viewport;
  uniform vec2 orbit;
  varying vec2 vUv;
  void main() {
    vUv = uv;
    vec3 p = vec3(position.x * cos(spin) + position.z * sin(spin), position.y,
                  -position.x * sin(spin) + position.z * cos(spin));
    p.y += offset;
    float tilt = -0.2 + 0.05 * sin(time * 0.2);
    p.yz = mat2(cos(tilt), sin(tilt), -sin(tilt), cos(tilt)) * p.yz;
    float roll = 0.2 + 0.05 * cos(time * 0.25);
    p.xy = mat2(cos(roll), sin(roll), -sin(roll), cos(roll)) * p.xy;
    // Inverse camera orbit: change the viewpoint without shifting the sphere centre.
    p.xz = mat2(cos(orbit.x), sin(orbit.x), -sin(orbit.x), cos(orbit.x)) * p.xz;
    p.yz = mat2(cos(orbit.y), sin(orbit.y), -sin(orbit.y), cos(orbit.y)) * p.yz;
    float aspect = viewport.x / viewport.y;
    p.xy *= min(1.0, aspect * 2.1);
    gl_Position = vec4(p.x / (aspect * 0.4663), p.y / 0.4663, 0.0, 6.0 - p.z);
  }
`;

const fragmentSource = `
  precision mediump float;
  uniform sampler2D map;
  varying vec2 vUv;
  void main() {
    vec4 text = texture2D(map, vUv);
    if (text.a < 0.02) discard;
    gl_FragColor = text;
  }
`;

/** Two transparent text spheres. No model downloads or additional rendering dependency. */
export function createSphereRenderer(canvas: HTMLCanvasElement) {
    const gl = canvas.getContext("webgl", {
        alpha: true,
        antialias: true,
        premultipliedAlpha: false,
    });
    if (!gl) return null;
    const dispose: (() => void)[] = [];

    try {
        const shader = (type: number, source: string) => {
            const result = gl.createShader(type);
            if (!result) throw new Error("Cannot allocate preloader shader");
            dispose.push(() => gl.deleteShader(result));
            gl.shaderSource(result, source);
            gl.compileShader(result);
            if (!gl.getShaderParameter(result, gl.COMPILE_STATUS))
                throw new Error("Cannot compile preloader shader");
            return result;
        };
        const program = gl.createProgram();
        if (!program) throw new Error("Cannot allocate preloader program");
        dispose.push(() => gl.deleteProgram(program));
        gl.attachShader(program, shader(gl.VERTEX_SHADER, vertexSource));
        gl.attachShader(program, shader(gl.FRAGMENT_SHADER, fragmentSource));
        gl.linkProgram(program);
        if (!gl.getProgramParameter(program, gl.LINK_STATUS))
            throw new Error("Cannot link preloader program");
        gl.useProgram(program);

        const vertices: number[] = [];
        const indices: number[] = [];
        const columns = 96;
        const rows = 48;
        for (let row = 0; row <= rows; row++) {
            const v = row / rows;
            const latitude = v * Math.PI;
            for (let col = 0; col <= columns; col++) {
                const u = col / columns;
                const longitude = u * Math.PI * 2;
                vertices.push(
                    -Math.cos(longitude) * Math.sin(latitude),
                    Math.cos(latitude),
                    Math.sin(longitude) * Math.sin(latitude),
                    u,
                    1 - v,
                );
                if (row < rows && col < columns) {
                    const a = row * (columns + 1) + col;
                    const b = a + columns + 1;
                    indices.push(a, b, a + 1, b, b + 1, a + 1);
                }
            }
        }
        const vertexBuffer = gl.createBuffer();
        const indexBuffer = gl.createBuffer();
        dispose.push(() => {
            gl.deleteBuffer(vertexBuffer);
            gl.deleteBuffer(indexBuffer);
        });
        gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
        gl.bufferData(
            gl.ARRAY_BUFFER,
            new Float32Array(vertices),
            gl.STATIC_DRAW,
        );
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
        gl.bufferData(
            gl.ELEMENT_ARRAY_BUFFER,
            new Uint16Array(indices),
            gl.STATIC_DRAW,
        );
        for (const [name, count, offset] of [
            ["position", 3, 0],
            ["uv", 2, 12],
        ] as const) {
            const location = gl.getAttribLocation(program, name);
            gl.enableVertexAttribArray(location);
            gl.vertexAttribPointer(
                location,
                count,
                gl.FLOAT,
                false,
                20,
                offset,
            );
        }

        const textureCanvas = document.createElement("canvas");
        textureCanvas.width = 2048;
        textureCanvas.height = 1024;
        const context = textureCanvas.getContext("2d");
        if (!context) throw new Error("Cannot create preloader typography");
        const textures = preloader.bands.map(() => {
            const texture = gl.createTexture();
            if (!texture) throw new Error("Cannot allocate preloader texture");
            dispose.push(() => gl.deleteTexture(texture));
            return texture;
        });
        const updateTypography = () => {
            preloader.bands.forEach((band, index) => {
                const text = `${band.text} `.repeat(band.repetitions).trim();
                context.clearRect(0, 0, 2048, 1024);
                context.font = `${band.fontWeight} ${band.fontSize}px "Tomato Grotesk", sans-serif`;
                context.textBaseline = "middle";
                context.fillStyle = "#000";
                // Fit each phrase to a full equatorial band, preserving a gap at the seam.
                context.save();
                context.translate(24, 512);
                context.scale(2000 / context.measureText(text).width, 1);
                context.fillText(text, 0, 0);
                context.restore();
                gl.bindTexture(gl.TEXTURE_2D, textures[index]);
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
                gl.texParameteri(
                    gl.TEXTURE_2D,
                    gl.TEXTURE_WRAP_T,
                    gl.CLAMP_TO_EDGE,
                );
                gl.texParameteri(
                    gl.TEXTURE_2D,
                    gl.TEXTURE_MIN_FILTER,
                    gl.LINEAR,
                );
                gl.texParameteri(
                    gl.TEXTURE_2D,
                    gl.TEXTURE_MAG_FILTER,
                    gl.LINEAR,
                );
                gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
                gl.texImage2D(
                    gl.TEXTURE_2D,
                    0,
                    gl.RGBA,
                    gl.RGBA,
                    gl.UNSIGNED_BYTE,
                    textureCanvas,
                );
            });
        };
        updateTypography();

        const uniforms = Object.fromEntries(
            ["spin", "offset", "time", "viewport", "orbit"].map((name) => [
                name,
                gl.getUniformLocation(program, name),
            ]),
        );
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
        gl.enable(gl.CULL_FACE);
        gl.clearColor(0, 0, 0, 0);

        const render = (time: number, pose: SpherePose, orbit: SphereOrbit) => {
            const ratio = Math.min(window.devicePixelRatio || 1, 1.5);
            const width = Math.max(1, Math.round(canvas.clientWidth * ratio));
            const height = Math.max(1, Math.round(canvas.clientHeight * ratio));
            if (canvas.width !== width || canvas.height !== height) {
                canvas.width = width;
                canvas.height = height;
                gl.viewport(0, 0, width, height);
            }
            gl.clear(gl.COLOR_BUFFER_BIT);
            gl.uniform2f(uniforms.viewport, width, height);
            gl.uniform1f(uniforms.time, time);
            gl.uniform2f(uniforms.orbit, orbit.yaw, orbit.pitch);
            textures.forEach((texture, index) => {
                gl.bindTexture(gl.TEXTURE_2D, texture);
                gl.uniform1f(
                    uniforms.spin,
                    time * preloader.bands[index].rotationSpeed,
                );
                gl.uniform1f(
                    uniforms.offset,
                    index === 0 ? pose.upper : pose.lower,
                );
                // The reverse side is visible through the transparent front of each sphere.
                for (const side of [gl.FRONT, gl.BACK]) {
                    gl.cullFace(side);
                    gl.drawElements(
                        gl.TRIANGLES,
                        indices.length,
                        gl.UNSIGNED_SHORT,
                        0,
                    );
                }
            });
        };

        return {
            render,
            updateTypography,
            dispose: () => dispose.reverse().forEach((release) => release()),
        };
    } catch {
        dispose.reverse().forEach((release) => release());
        return null;
    }
}
