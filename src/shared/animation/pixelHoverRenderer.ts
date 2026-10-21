import { getFrameRatio } from './frameTiming'
import { pixelHoverConfig } from './pixelHover.config'

const { gridColumns: columns, maxOffset } = pixelHoverConfig
const vertexSource = `
  attribute vec2 position;
  varying vec2 uv;
  void main() {
    uv = vec2(position.x + 1.0, 1.0 - position.y) * 0.5;
    gl_Position = vec4(position, 0.0, 1.0);
  }
`
const fragmentSource = `
  precision highp float;
  uniform sampler2D photo;
  uniform sampler2D field;
  uniform vec2 imageScale;
  uniform vec2 imageOffset;
  uniform float maxOffset;
  uniform float chromaticAberration;
  uniform float opacityThreshold;
  uniform float restThreshold;
  varying vec2 uv;

  vec4 samplePhoto(vec2 point) {
    vec2 source = point * imageScale + imageOffset;
    if (min(source.x, source.y) < 0.0 || max(source.x, source.y) > 1.0) return vec4(0.0);
    return texture2D(photo, source);
  }

  void main() {
    vec4 cell = texture2D(field, uv);
    float strength = cell.b;
    if (strength < restThreshold) { gl_FragColor = vec4(0.0); return; }
    vec2 offset = (cell.rg * 255.0 - 128.0) / 127.0 * maxOffset;
    vec2 point = uv - offset;
    vec4 color = samplePhoto(point);
    vec2 split = offset * chromaticAberration;
    color.r = samplePhoto(point - split).r;
    color.b = samplePhoto(point + split).b;
    color.a *= smoothstep(0.0, opacityThreshold, strength);
    gl_FragColor = color;
  }
`

/** A transparent, local displacement layer; the original accessible img stays in place. */
export function createPixelHoverRenderer(image: HTMLImageElement) {
  const canvas = document.createElement('canvas')
  canvas.setAttribute('aria-hidden', 'true')
  canvas.dataset.pixelHoverCanvas = ''
  Object.assign(canvas.style, {
    position: 'absolute', pointerEvents: 'none', display: 'none',
  })
  const gl = canvas.getContext('webgl', { alpha: true, premultipliedAlpha: false, depth: false, antialias: false })
  if (!gl) return null

  const shaders: WebGLShader[] = []
  const textures: WebGLTexture[] = []
  const program = gl.createProgram()
  const buffer = gl.createBuffer()
  let frame = 0
  let previousTime = 0
  let lost = false
  const dispose = () => {
    cancelAnimationFrame(frame)
    canvas.remove()
    gl.deleteBuffer(buffer)
    textures.forEach(texture => gl.deleteTexture(texture))
    shaders.forEach(shader => gl.deleteShader(shader))
    gl.deleteProgram(program)
    gl.getExtension('WEBGL_lose_context')?.loseContext()
  }

  try {
    if (!program || !buffer) throw new Error('WebGL resources unavailable')
    for (const [type, source] of [[gl.VERTEX_SHADER, vertexSource], [gl.FRAGMENT_SHADER, fragmentSource]] as const) {
      const shader = gl.createShader(type)
      if (!shader) throw new Error('Shader unavailable')
      shaders.push(shader)
      gl.shaderSource(shader, source)
      gl.compileShader(shader)
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error('Shader compilation failed')
      gl.attachShader(program, shader)
    }
    gl.linkProgram(program)
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error('Shader linking failed')
    gl.useProgram(program)
    gl.uniform1f(gl.getUniformLocation(program, 'maxOffset'), maxOffset)
    gl.uniform1f(gl.getUniformLocation(program, 'chromaticAberration'), pixelHoverConfig.chromaticAberration)
    gl.uniform1f(gl.getUniformLocation(program, 'opacityThreshold'), pixelHoverConfig.opacityThreshold)
    gl.uniform1f(gl.getUniformLocation(program, 'restThreshold'), pixelHoverConfig.restThreshold)
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), gl.STATIC_DRAW)
    const position = gl.getAttribLocation(program, 'position')
    gl.enableVertexAttribArray(position)
    gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0)

    for (let unit = 0; unit < 2; unit++) {
      const texture = gl.createTexture()
      if (!texture) throw new Error('Texture unavailable')
      textures.push(texture)
      gl.activeTexture(gl.TEXTURE0 + unit)
      gl.bindTexture(gl.TEXTURE_2D, texture)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, unit === 0 ? gl.LINEAR : gl.NEAREST)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, unit === 0 ? gl.LINEAR : gl.NEAREST)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
      gl.uniform1i(gl.getUniformLocation(program, unit === 0 ? 'photo' : 'field'), unit)
      if (unit === 0) {
        // Upload the original photo directly unless it exceeds the configured or GPU limit.
        const limit = Math.min(pixelHoverConfig.maxTextureSize, gl.getParameter(gl.MAX_TEXTURE_SIZE) as number)
        const scale = Math.min(1, limit / Math.max(image.naturalWidth, image.naturalHeight))
        let source: HTMLImageElement | HTMLCanvasElement = image
        if (scale < 1) {
          source = document.createElement('canvas')
          source.width = Math.max(1, Math.round(image.naturalWidth * scale))
          source.height = Math.max(1, Math.round(image.naturalHeight * scale))
          const context = source.getContext('2d')
          if (!context) throw new Error('Image upload unavailable')
          context.imageSmoothingQuality = 'high'
          context.drawImage(image, 0, 0, source.width, source.height)
        }
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source)
      }
    }

    const maxViewport = gl.getParameter(gl.MAX_VIEWPORT_DIMS) as Int32Array
    const maxRenderbuffer = gl.getParameter(gl.MAX_RENDERBUFFER_SIZE) as number
    let width = 0, height = 0, rows = 0, pixelRatio = 0
    let offsets = new Float32Array(0)
    let pixels = new Uint8Array(0)
    const resize = () => {
      const nextWidth = image.clientWidth, nextHeight = image.clientHeight
      if (!nextWidth || !nextHeight) return
      const nextRatio = Math.min(devicePixelRatio, pixelHoverConfig.maxPixelRatio,
        Math.sqrt(pixelHoverConfig.maxRenderPixels / (nextWidth * nextHeight)),
        maxViewport[0] / nextWidth, maxViewport[1] / nextHeight,
        maxRenderbuffer / Math.max(nextWidth, nextHeight))
      if (width === nextWidth && height === nextHeight && pixelRatio === nextRatio) return
      width = nextWidth
      height = nextHeight
      pixelRatio = nextRatio
      rows = Math.max(1, Math.round(columns * height / width))
      offsets = new Float32Array(columns * rows * 3)
      pixels = new Uint8Array(columns * rows * 4)
      canvas.width = Math.max(1, Math.round(width * pixelRatio))
      canvas.height = Math.max(1, Math.round(height * pixelRatio))
      Object.assign(canvas.style, { left: `${image.offsetLeft}px`, top: `${image.offsetTop}px`, width: `${width}px`, height: `${height}px` })
      gl.viewport(0, 0, canvas.width, canvas.height)

      const style = getComputedStyle(image)
      const fit = style.objectFit === 'contain'
        ? Math.min(width / image.naturalWidth, height / image.naturalHeight)
        : Math.max(width / image.naturalWidth, height / image.naturalHeight)
      const renderedWidth = image.naturalWidth * fit, renderedHeight = image.naturalHeight * fit
      const position = style.objectPosition.split(' ').map(value => parseFloat(value) / 100)
      gl.uniform2f(gl.getUniformLocation(program, 'imageScale'), width / renderedWidth, height / renderedHeight)
      gl.uniform2f(gl.getUniformLocation(program, 'imageOffset'),
        -(width - renderedWidth) * (position[0] ?? 0.5) / renderedWidth,
        -(height - renderedHeight) * (position[1] ?? 0.5) / renderedHeight)
    }

    const animate = (time: number) => {
      frame = 0
      if (lost) return
      resize()
      const decay = Math.pow(pixelHoverConfig.relaxation, previousTime ? getFrameRatio(time - previousTime) : 1)
      previousTime = time
      let energy = 0
      for (let cell = 0; cell < columns * rows; cell++) {
        const index = cell * 3, pixel = cell * 4
        offsets[index] *= decay
        offsets[index + 1] *= decay
        offsets[index + 2] *= decay
        energy = Math.max(energy, offsets[index + 2])
        pixels[pixel] = Math.round(128 + offsets[index] / maxOffset * 127)
        pixels[pixel + 1] = Math.round(128 + offsets[index + 1] / maxOffset * 127)
        pixels[pixel + 2] = Math.round(Math.min(1, offsets[index + 2]) * 255)
        pixels[pixel + 3] = 255
      }
      if (energy < pixelHoverConfig.restThreshold || document.hidden) {
        canvas.style.display = 'none'
        offsets.fill(0)
        previousTime = 0
        return
      }
      gl.activeTexture(gl.TEXTURE1)
      gl.bindTexture(gl.TEXTURE_2D, textures[1])
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, columns, rows, 0, gl.RGBA, gl.UNSIGNED_BYTE, pixels)
      gl.drawArrays(gl.TRIANGLES, 0, 6)
      canvas.style.display = 'block'
      frame = requestAnimationFrame(animate)
    }

    canvas.addEventListener('webglcontextlost', () => {
      lost = true
      cancelAnimationFrame(frame)
      canvas.style.display = 'none'
    })
    image.after(canvas)
    resize()
    return {
      move(x: number, y: number, dx: number, dy: number) {
        if (lost) return
        resize()
        const speed = Math.min(1, Math.hypot(dx * columns, dy * rows))
        if (speed < pixelHoverConfig.minSpeed) return
        const { radius, strength, falloff } = pixelHoverConfig
        for (let row = Math.max(0, Math.floor(y * rows - radius)); row < Math.min(rows, y * rows + radius); row++) {
          for (let column = Math.max(0, Math.floor(x * columns - radius)); column < Math.min(columns, x * columns + radius); column++) {
            const distance = Math.hypot(column + 0.5 - x * columns, row + 0.5 - y * rows)
            const weight = Math.max(0, 1 - distance / radius) ** falloff
            const index = (row * columns + column) * 3
            offsets[index] = Math.max(-maxOffset, Math.min(maxOffset, offsets[index] + dx * weight * strength))
            offsets[index + 1] = Math.max(-maxOffset, Math.min(maxOffset, offsets[index + 1] + dy * weight * strength))
            offsets[index + 2] = Math.min(1, offsets[index + 2] + weight * speed)
          }
        }
        if (!frame) frame = requestAnimationFrame(animate)
      },
      dispose,
    }
  } catch {
    dispose()
    return null
  }
}
