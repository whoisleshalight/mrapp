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

function media(properties = {}, top = 0) {
  const target = new EventTarget()
  const listeners = new Set()
  const add = target.addEventListener.bind(target)
  const remove = target.removeEventListener.bind(target)
  target.addEventListener = (event, listener, options) => { listeners.add(listener); add(event, listener, options) }
  target.removeEventListener = (event, listener) => { listeners.delete(listener); remove(event, listener) }
  return Object.assign(target, {
    getBoundingClientRect: () => ({ top, bottom: top + 200, left: 0, right: 300, width: 300, height: 200 }),
    hasAttribute: () => false,
    complete: false, naturalWidth: 0, decode: async () => {}, listeners,
    ...properties,
  })
}

function harness({ images = [], videos = [], fonts = Promise.resolve(), aborted = false } = {}) {
  const exports = {}
  const states = []
  const controller = new AbortController()
  if (aborted) controller.abort()
  let deadline
  let cleared = false
  runInNewContext(outputText, {
    exports, AbortController,
    document: { fonts: { ready: fonts }, querySelectorAll: (selector) => selector === 'main img' ? images : videos },
    window: {
      innerWidth: 1440, innerHeight: 900,
      setTimeout: (callback) => { deadline = callback; return 1 },
      clearTimeout: () => { cleared = true },
    },
  })
  const done = exports.waitForInitialAssets({ signal: controller.signal, timeout: 8000, onProgress: (state) => states.push(state) })
  return { states, controller, done, timeout: () => deadline(), get cleared() { return cleared } }
}

test('startup progress waits for route fonts, visible image decoding and the first autoplay video frame', async () => {
  const fonts = deferred()
  const decoding = deferred()
  const image = media({ decode: () => decoding.promise })
  const video = media({ autoplay: true, readyState: 0, error: null })
  const h = harness({ images: [image], videos: [video], fonts: fonts.promise })
  assert.equal(h.states.at(-1).progress, 33)
  fonts.resolve()
  await tick()
  assert.equal(h.states.at(-1).progress, 66)
  image.naturalWidth = 300
  image.dispatchEvent(new Event('load'))
  await tick()
  assert.equal(h.states.at(-1).progress, 66, 'Image load alone does not guarantee decoded pixels')
  decoding.resolve()
  await tick()
  assert.equal(h.states.at(-1).progress, 83)
  assert.equal(h.states.at(-1).settled, false)
  video.dispatchEvent(new Event('loadeddata'))
  await h.done
  assert.equal(h.states.at(-1).progress, 100)
  assert.equal(h.states.at(-1).settled, true)
  assert.equal(h.cleared, true)
  assert.equal(image.listeners.size + video.listeners.size, 0)
})

test('below-fold images and paused videos never hold the first screen', async () => {
  const image = media({}, 1200)
  const video = media({ autoplay: false, readyState: 0 })
  const h = harness({ images: [image], videos: [video] })
  await h.done
  assert.equal(h.states.at(-1).progress, 100)
  assert.equal(image.listeners.size + video.listeners.size, 0)
})

test('explicit hero media is tracked even before an entrance animation places it in view', async () => {
  const image = media({ hasAttribute: (name) => name === 'data-preload' }, 1200)
  const h = harness({ images: [image] })
  await tick()
  assert.equal(h.states.at(-1).settled, false)
  image.dispatchEvent(new Event('error'))
  await h.done
  assert.equal(h.states.at(-1).progress, 100)
})

test('media visibility is measured after fonts establish the final layout', async () => {
  const fonts = deferred()
  const image = media({}, 1200)
  const h = harness({ images: [image], fonts: fonts.promise })
  image.getBoundingClientRect = () => ({ top: 100, bottom: 300, left: 0, right: 300, width: 300, height: 200 })
  fonts.resolve()
  await tick()
  assert.equal(h.states.at(-1).settled, false)
  image.dispatchEvent(new Event('error'))
  await h.done
  assert.equal(h.states.at(-1).progress, 100)
})

test('cached and broken media settle without waiting for a new load event', async () => {
  const images = [media({ complete: true, naturalWidth: 300 }), media({ complete: true })]
  const videos = [media({ autoplay: true, readyState: 0, error: new Error('Failed') })]
  const h = harness({ images, videos })
  await h.done
  assert.equal(h.states.at(-1).progress, 100)
  assert.ok([...images, ...videos].every((item) => item.listeners.size === 0))
})

test('network errors release media tasks and allow the page fallback to display', async () => {
  const image = media()
  const video = media({ autoplay: true, readyState: 0, error: null })
  const h = harness({ images: [image], videos: [video] })
  await tick()
  image.dispatchEvent(new Event('error'))
  video.dispatchEvent(new Event('error'))
  await h.done
  assert.equal(h.states.at(-1).settled, true)
  assert.equal(h.states.at(-1).timedOut, false)
})

test('deadline releases a stalled font and media without claiming 100 percent', async () => {
  const fonts = deferred()
  const image = media()
  const h = harness({ images: [image], fonts: fonts.promise })
  h.timeout()
  await h.done
  assert.equal(h.states.at(-1).timedOut, true)
  assert.equal(h.states.at(-1).settled, true)
  assert.ok(h.states.at(-1).progress < 100)
  assert.equal(image.listeners.size, 0)
  const count = h.states.length
  fonts.resolve()
  image.dispatchEvent(new Event('load'))
  await tick()
  assert.equal(h.states.length, count, 'Late completions must not publish stale progress')
})

test('StrictMode cleanup aborts all listeners, timers and progress callbacks', async () => {
  const image = media()
  const h = harness({ images: [image], fonts: deferred().promise })
  const count = h.states.length
  h.controller.abort()
  await h.done
  assert.equal(image.listeners.size, 0)
  assert.equal(h.cleared, true)
  assert.equal(h.states.length, count)
})

test('a cancelled startup never registers work', async () => {
  const image = media()
  const h = harness({ images: [image], aborted: true })
  await h.done
  assert.equal(h.states.length, 0)
  assert.equal(image.listeners.size, 0)
})
