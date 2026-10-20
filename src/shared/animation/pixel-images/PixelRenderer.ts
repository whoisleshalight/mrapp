import { pixelConfig as config } from './config'
import { DisplacementGrid } from './DisplacementGrid'
import { nativeClip } from './nativeClip'
import { fragmentShader, vertexShader } from './shaders'

function shader(gl: WebGLRenderingContext, type: number, source: string) {
  const result = gl.createShader(type)
  if (!result) throw new Error('Pixel shader unavailable')
  gl.shaderSource(result, source)
  gl.compileShader(result)
  if (!gl.getShaderParameter(result, gl.COMPILE_STATUS)) {
    gl.deleteShader(result)
    throw new Error('Pixel shader compilation failed')
  }
  return result
}

/** Reusable bounded context: two textures and one triangle per photo draw. */
export class PixelRenderer {
  readonly canvas = document.createElement('canvas')
  private readonly gl: WebGLRenderingContext
  private readonly program: WebGLProgram
  private readonly buffer: WebGLBuffer
  private readonly imageTexture: WebGLTexture
  private readonly gridTexture: WebGLTexture
  private readonly uniforms: Record<string, WebGLUniformLocation | null>
  private source: HTMLImageElement | null = null
  private sourceUrl = ''
  private grid: DisplacementGrid | null = null
  private activeImage: HTMLImageElement | null = null
  private clip: ReturnType<typeof nativeClip> | null = null
  private clipKey: string | null = null

  constructor() {
    const gl = this.canvas.getContext('webgl', {
      alpha: true, antialias: false, depth: false, stencil: false,
      premultipliedAlpha: true, preserveDrawingBuffer: false,
      powerPreference: 'low-power',
    })
    if (!gl) throw new Error('WebGL unavailable')
    this.gl = gl
    const program = gl.createProgram()
    const buffer = gl.createBuffer()
    const imageTexture = gl.createTexture()
    const gridTexture = gl.createTexture()
    if (!program || !buffer || !imageTexture || !gridTexture) {
      this.releaseContext()
      throw new Error('Pixel resources unavailable')
    }
    this.program = program
    this.buffer = buffer
    this.imageTexture = imageTexture
    this.gridTexture = gridTexture
    try {
      const vertex = shader(gl, gl.VERTEX_SHADER, vertexShader)
      gl.attachShader(program, vertex)
      gl.deleteShader(vertex)
      const fragment = shader(gl, gl.FRAGMENT_SHADER, fragmentShader)
      gl.attachShader(program, fragment)
      gl.deleteShader(fragment)
      gl.linkProgram(program)
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error('Pixel program linking failed')
    } catch (error) {
      this.dispose()
      throw error
    }
    gl.useProgram(program)
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW)
    const position = gl.getAttribLocation(program, 'position')
    gl.enableVertexAttribArray(position)
    gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0)
    this.uniforms = Object.fromEntries(
      ['image', 'grid', 'crop', 'cropOrigin', 'corners', 'overflow', 'displacement', 'maxOffset', 'pixelSize'].map((name) => [name, gl.getUniformLocation(program, name)]),
    )
    for (const [unit, texture] of [[0, imageTexture], [1, gridTexture]] as const) {
      gl.activeTexture(gl.TEXTURE0 + unit)
      gl.bindTexture(gl.TEXTURE_2D, texture)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, unit ? gl.NEAREST : gl.LINEAR)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, unit ? gl.NEAREST : gl.LINEAR)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    }
    gl.uniform1i(this.uniforms.image, 0)
    gl.uniform1i(this.uniforms.grid, 1)
    gl.uniform1f(this.uniforms.overflow, config.overflow)
    gl.uniform1f(this.uniforms.displacement, config.displacement)
    gl.uniform1f(this.uniforms.maxOffset, config.maxOffset)
    this.canvas.className = 'pixelImageCanvas'
    this.canvas.setAttribute('aria-hidden', 'true')
  }

  /** Resize the upload without creating another canvas or retaining decoded copies. */
  async prepare(image: HTMLImageElement, signal: AbortSignal) {
    if (image === this.source && image.currentSrc === this.sourceUrl) return
    const scale = Math.min(1, config.maxTextureSide / Math.max(image.naturalWidth, image.naturalHeight))
    const bitmap = await createImageBitmap(image, {
      resizeWidth: Math.max(1, Math.round(image.naturalWidth * scale)),
      resizeHeight: Math.max(1, Math.round(image.naturalHeight * scale)),
      resizeQuality: 'medium',
    })
    try {
      if (signal.aborted) return
      const gl = this.gl
      gl.activeTexture(gl.TEXTURE0)
      gl.bindTexture(gl.TEXTURE_2D, this.imageTexture)
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, bitmap)
      this.source = image
      this.sourceUrl = image.currentSrc
    } finally { bitmap.close() }
  }

  attach(image: HTMLImageElement) {
    // All geometry reads precede drawing buffer and DOM writes.
    const bounds = image.getBoundingClientRect()
    const style = getComputedStyle(image)
    // offsetWidth/Height round fractional CSS pixels and shift the canvas edges.
    const width = parseFloat(style.width)
    const height = parseFloat(style.height)
    const left = image.offsetLeft
    const top = image.offsetTop
    const cut = Math.max(0, parseFloat(style.getPropertyValue('--cut')) || 0)
    const corners = image.dataset.pixelImageCorners ?? ''
    const imageAspect = image.naturalWidth / image.naturalHeight
    const aspect = width / height
    const cropX = style.objectFit === 'cover' ? Math.min(1, aspect / imageAspect) : 1
    const cropY = style.objectFit === 'cover' ? Math.min(1, imageAspect / aspect) : 1
    const position = style.objectPosition.split(' ').map(parseFloat)
    const canvasScale = 1 + 2 * config.overflow
    const cssWidth = width * canvasScale
    const cssHeight = height * canvasScale
    const resolution = Math.min(1, Math.sqrt(config.maxRenderPixels / (cssWidth * cssHeight)))
    this.canvas.width = Math.max(1, Math.floor(cssWidth * resolution))
    this.canvas.height = Math.max(1, Math.floor(cssHeight * resolution))
    Object.assign(this.canvas.style, {
      left: `${left - width * config.overflow}px`, top: `${top - height * config.overflow}px`,
      width: `${cssWidth}px`, height: `${cssHeight}px`,
    })
    const gl = this.gl
    gl.viewport(0, 0, this.canvas.width, this.canvas.height)
    gl.uniform2f(this.uniforms.pixelSize, canvasScale / this.canvas.width, canvasScale / this.canvas.height)
    gl.uniform2f(this.uniforms.crop, cropX, cropY)
    gl.uniform2f(this.uniforms.cropOrigin, (1 - cropX) * position[0] / 100, (1 - cropY) * position[1] / 100)
    gl.uniform4f(this.uniforms.corners,
      corners.includes('top-left') ? cut / width : 0, corners.includes('top-left') ? cut / height : 0,
      corners.includes('bottom-right') ? cut / width : 0, corners.includes('bottom-right') ? cut / height : 0,
    )
    // The interaction cells are square on screen, including cropped photos.
    this.grid = new DisplacementGrid(aspect)
    this.activeImage = image
    this.clip = nativeClip(width, height, cut, corners, this.grid.width, this.grid.height,
      Math.max(cssWidth / this.canvas.width, cssHeight / this.canvas.height))
    this.clipKey = null
    gl.activeTexture(gl.TEXTURE1)
    gl.bindTexture(gl.TEXTURE_2D, this.gridTexture)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, this.grid.width, this.grid.height, 0, gl.RGBA, gl.UNSIGNED_BYTE, this.grid.pixels)
    // Keep the existing CSS scroll reveal and card labels above the cursor pixels.
    image.insertAdjacentElement('afterend', this.canvas)
    return bounds
  }

  draw(x: number, y: number, velocityX: number, velocityY: number, ratio: number) {
    if (!this.grid?.update(x, y, velocityX, velocityY, ratio)) return false
    const cells: number[] = []
    for (let index = 0; index < this.grid.offsets.length; index += 2) {
      if ((this.grid.offsets[index] || this.grid.offsets[index + 1]) && this.clip?.cells[index / 2]) cells.push(index / 2)
    }
    const key = cells.join(',')
    if (key !== this.clipKey && this.clip && this.activeImage) {
      this.clipKey = key
      this.activeImage.style.setProperty('--pixel-clip', `path(evenodd, "${this.clip.outline}${cells.map((cell) => this.clip!.cells[cell]).join('')}")`)
    }
    const gl = this.gl
    gl.activeTexture(gl.TEXTURE1)
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, this.grid.width, this.grid.height, gl.RGBA, gl.UNSIGNED_BYTE, this.grid.pixels)
    gl.drawArrays(gl.TRIANGLES, 0, 3)
    return true
  }

  detach() {
    this.activeImage?.style.removeProperty('--pixel-clip')
    this.activeImage = null
    this.clip = null
    this.clipKey = null
    this.canvas.remove()
    this.grid = null
    // Release the large framebuffer while retaining one bounded image texture.
    this.canvas.width = this.canvas.height = 1
  }

  private releaseContext() { this.gl.getExtension('WEBGL_lose_context')?.loseContext() }

  dispose() {
    this.detach()
    this.gl.deleteTexture(this.imageTexture)
    this.gl.deleteTexture(this.gridTexture)
    this.gl.deleteBuffer(this.buffer)
    this.gl.deleteProgram(this.program)
    this.source = null
    this.releaseContext()
  }
}
