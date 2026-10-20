import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { setImmediate as tick } from 'node:timers/promises'
import { runInNewContext } from 'node:vm'
import test from 'node:test'
import ts from 'typescript'

const { outputText } = ts.transpileModule(readFileSync('src/app/components/Preloader/initialAssets.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS },
})
const deferred = () => {
  let resolve
  const promise = new Promise((done) => { resolve = done })
  return { promise, resolve }
}

function media(properties = {}) {
  const target = new EventTarget()
  const listeners = new Set()
  const add = target.addEventListener.bind(target)
  const remove = target.removeEventListener.bind(target)
  target.addEventListener = (event, listener, options) => { listeners.add(listener); add(event, listener, options) }
  target.removeEventListener = (event, listener) => { listeners.delete(listener); remove(event, listener) }
  return Object.assign(target, {
    loading: 'lazy', complete: false, naturalWidth: 0, decode: async () => {}, listeners,
    ...properties,
  })
}

function harness({ images = [], videos = [], fonts = Promise.resolve(), loaded = true, aborted = false } = {}) {
  const exports = {}
  const states = []
  const controller = new AbortController()
  const window = media()
  const document = {
    readyState: loaded ? 'complete' : 'interactive',
    fonts: { ready: fonts },
    querySelectorAll: (selector) => selector === 'img' ? images : videos,
  }
  if (aborted) controller.abort()
  runInNewContext(outputText, { exports, AbortController, document, window })
  const done = exports.waitForInitialAssets({ signal: controller.signal, onProgress: (state) => states.push(state) })
  return {
    states, controller, done, window, document,
    load() { document.readyState = 'complete'; window.dispatchEvent(new Event('load')) },
  }
}

test('startup waits for document scripts/styles, final fonts, decoded images and playable autoplay video', async () => {
  const fonts = deferred()
  const decoding = deferred()
  const image = media({ decode: () => decoding.promise })
  const video = media({ autoplay: true, readyState: 0, error: null })
  const h = harness({ images: [image], videos: [video], fonts: fonts.promise, loaded: false })
  assert.equal(h.states.at(-1).progress, 20)
  h.load()
  await tick()
  assert.equal(h.states.at(-1).progress, 40)
  fonts.resolve()
  await tick()
  assert.equal(h.states.at(-1).progress, 60)
  image.naturalWidth = 300
  image.dispatchEvent(new Event('load'))
  await tick()
  assert.equal(h.states.at(-1).progress, 60, 'Image load alone does not guarantee decoded pixels')
  decoding.resolve()
  await tick()
  assert.equal(h.states.at(-1).progress, 80)
  assert.equal(h.states.at(-1).settled, false)
  video.dispatchEvent(new Event('canplay'))
  await h.done
  assert.equal(h.states.at(-1).progress, 100)
  assert.equal(h.states.at(-1).settled, true)
  assert.equal(image.listeners.size + video.listeners.size + h.window.listeners.size, 0)
})

test('every lazy image is promoted to eager and blocks completion until loaded', async () => {
  const image = media()
  const h = harness({ images: [image] })
  await tick()
  assert.equal(image.loading, 'eager')
  assert.equal(h.states.at(-1).progress, 75)
  assert.equal(h.states.at(-1).settled, false)
  image.naturalWidth = 300
  image.dispatchEvent(new Event('load'))
  await h.done
  assert.equal(h.states.at(-1).progress, 100)
})

test('pending document scripts or styles keep the loader active with no timer escape', async () => {
  const h = harness({ loaded: false })
  await tick()
  assert.equal(h.states.at(-1).settled, false)
  assert.ok(h.window.listeners.size > 0)
  h.load()
  await h.done
  assert.equal(h.states.at(-1).progress, 100)
})

test('fonts requested by a late stylesheet are observed after window load', async () => {
  const fonts = deferred()
  const h = harness({ loaded: false })
  h.document.fonts.ready = fonts.promise
  h.load()
  await tick()
  assert.equal(h.states.at(-1).settled, false)
  fonts.resolve()
  await h.done
  assert.equal(h.states.at(-1).progress, 100)
})

test('paused video does not block startup waiting for autoplay', async () => {
  const video = media({ autoplay: false, readyState: 0 })
  const h = harness({ videos: [video] })
  await h.done
  assert.equal(h.states.at(-1).progress, 100)
  assert.equal(video.listeners.size, 0)
})

test('cached and broken media settle without waiting for a new load event', async () => {
  const images = [media({ complete: true, naturalWidth: 300 }), media({ complete: true })]
  const videos = [media({ autoplay: true, readyState: 0, error: new Error('Failed') })]
  const h = harness({ images, videos })
  await h.done
  assert.equal(h.states.at(-1).progress, 100)
  assert.ok([...images, ...videos].every((item) => item.listeners.size === 0))
})

test('network errors settle failed resource requests and allow the page fallback to display', async () => {
  const image = media()
  const video = media({ autoplay: true, readyState: 0, error: null })
  const h = harness({ images: [image], videos: [video] })
  image.dispatchEvent(new Event('error'))
  video.dispatchEvent(new Event('error'))
  await h.done
  assert.equal(h.states.at(-1).settled, true)
})

test('StrictMode cleanup aborts document/media listeners and prevents stale progress', async () => {
  const fonts = deferred()
  const image = media()
  const h = harness({ images: [image], fonts: fonts.promise, loaded: false })
  const count = h.states.length
  h.controller.abort()
  await h.done
  assert.equal(image.listeners.size + h.window.listeners.size, 0)
  h.load()
  fonts.resolve()
  image.dispatchEvent(new Event('load'))
  await tick()
  assert.equal(h.states.length, count)
})

test('a cancelled startup never registers work', async () => {
  const image = media()
  const h = harness({ images: [image], aborted: true })
  await h.done
  assert.equal(h.states.length, 0)
  assert.equal(image.listeners.size + h.window.listeners.size, 0)
})
