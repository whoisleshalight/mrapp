import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { setImmediate as tick } from 'node:timers/promises'
import { runInNewContext } from 'node:vm'
import test from 'node:test'
import ts from 'typescript'

const deferred = () => {
  let resolve
  const promise = new Promise((done) => { resolve = done })
  return { promise, resolve }
}

function load(file, imports, environment) {
  const exports = {}
  const { outputText } = ts.transpileModule(readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  })
  runInNewContext(outputText, {
    exports,
    require: (name) => {
      assert.ok(name in imports, `Unexpected import: ${name}`)
      return imports[name]
    },
    AbortController, setTimeout, clearTimeout, console,
    ...environment,
  }, { filename: file })
  return exports
}

function harness({ reduced = false, smooth = true, images = [], fonts = Promise.resolve() } = {}) {
  const root = { dataset: {} }
  const main = { querySelectorAll: () => images }
  const window = Object.assign(new EventTarget(), {
    scrollY: 500, innerHeight: 800,
    scrollTo: ({ top }) => { window.scrollY = top },
  })
  const environment = {
    window,
    document: { fonts: { ready: fonts }, getElementById: () => main },
    requestAnimationFrame: (callback) => setTimeout(callback, 0),
    cancelAnimationFrame: clearTimeout,
  }
  const config = { motion: { transitionDuration: 0.8, assetWaitTimeout: 100 }, prefersReducedMotion: () => reduced }
  const readiness = load('src/app/components/PageTransition/readiness.ts', { '../../config/motion': config }, environment)
  const tweens = []
  const scrolls = []
  const states = []
  let paused = false
  const smoother = {
    paused(value) {
      if (value === undefined) return paused
      paused = value
    },
    scrollTop(value) { scrolls.push(value); window.scrollY = value },
  }
  const gsap = {
    set: (element, properties) => Object.assign(element, properties),
    to(element, properties) {
      const tween = {
        properties, killed: false,
        kill() { this.killed = true },
        complete() {
          if (this.killed) return
          Object.assign(element, properties)
          properties.onComplete?.()
        },
      }
      tweens.push(tween)
      return tween
    },
  }
  const refs = []
  const hooks = []
  let cursor = 0
  let currentKey = 'old'
  let blocker = { state: 'unblocked' }
  const layoutEffects = []
  const effects = []
  const setReady = (...args) => states.push(args)
  const effect = (queue) => (callback, dependencies) => {
    const index = cursor++
    const previous = hooks[index]
    if (previous && dependencies.every((value, i) => Object.is(value, previous.dependencies[i]))) return
    queue.push(() => {
      previous?.cleanup?.()
      hooks[index] = { dependencies, cleanup: callback() }
    })
  }
  const component = load('src/app/components/PageTransition/PageTransition.tsx', {
    react: {
      useContext: () => setReady,
      useRef: (value) => { const index = cursor++; return refs[index] ??= { current: value } },
      useEffect: effect(effects), useLayoutEffect: effect(layoutEffects),
    },
    'react/jsx-runtime': { jsx: (_, props) => ({ props }) },
    'react-router': { useBlocker: () => blocker, useLocation: () => ({ key: currentKey }) },
    '../../../shared/animation/gsap': {
      gsap, ScrollSmoother: { get: () => smooth ? smoother : undefined },
      ScrollTrigger: { refresh() {}, maxScroll: () => 1000 },
    },
    '../../config/motion': config,
    './PageTransition.module.scss': { default: { overlay: 'overlay' } },
    '../../../shared/animation/readiness': { TransitionReadinessContext: {} },
    './readiness': readiness,
  }, environment).default

  const render = (key = currentKey, nextBlocker = blocker) => {
    cursor = 0
    currentKey = key
    blocker = nextBlocker
    component().props.ref.current = root
    while (layoutEffects.length) layoutEffects.shift()()
    while (effects.length) effects.shift()()
  }
  render()
  return { render, root, window, tweens, scrolls, states, readiness, get paused() { return paused } }
}

async function until(predicate) {
  for (let i = 0; i < 100; i++) {
    if (predicate()) return
    await new Promise((resolve) => setTimeout(resolve, 1))
  }
  assert.fail('Transition did not reach the expected state')
}

test('waits for route commit, fonts and image decoding before revealing at the restored scroll position', async () => {
  const fonts = deferred()
  const image = deferred()
  const h = harness({ fonts: fonts.promise, images: [{ loading: 'eager', decode: () => image.promise }] })
  let proceeded = false
  h.render('old', { state: 'blocked', proceed: () => { proceeded = true } })
  assert.equal(proceeded, false)
  assert.equal(h.paused, true)
  assert.equal(h.states.length, 0, 'Outgoing animations must remain intact during dimming')
  h.tweens[0].complete()
  assert.equal(proceeded, true)
  assert.equal(h.root.dataset.transitionState, 'loading')
  assert.equal(h.tweens.length, 1, 'Lazy route has not committed yet')

  h.window.scrollY = 240 // Back/Forward restoration applied by the router.
  h.render('new', { state: 'unblocked' })
  await until(() => h.scrolls.length === 1)
  fonts.resolve()
  await tick()
  assert.equal(h.tweens.length, 1, 'Image is still decoding')
  h.window.scrollY = 700 // Simulate an obsolete smoother update while assets load.
  image.resolve()
  await until(() => h.tweens.length === 2)
  assert.equal(h.window.scrollY, 240)
  assert.equal(h.root.dataset.transitionState, 'revealing')
  assert.equal(h.paused, true)
  h.tweens[1].complete()
  assert.equal(h.paused, false)
  assert.equal(h.root.dataset.transitionState, 'idle')
  assert.deepEqual(h.states.at(-1), [true, false])
})

test('an interrupted route cannot reveal over a newer navigation', async () => {
  const image = deferred()
  const h = harness({ images: [{ loading: 'eager', decode: () => image.promise }] })
  h.render('old', { state: 'blocked', proceed() {} })
  h.tweens[0].complete()
  h.window.scrollY = 0
  h.render('first', { state: 'unblocked' })
  await until(() => h.scrolls.length === 1)
  h.render('first', { state: 'blocked', proceed() {} })
  h.tweens[1].complete()
  h.render('second', { state: 'unblocked' })
  image.resolve()
  await until(() => h.tweens.length === 3)
  await tick()
  assert.equal(h.tweens.filter((tween) => tween.properties.yPercent === -100).length, 1)
  h.tweens[2].complete()
  assert.equal(h.paused, false)
})

test('reduced motion and native scrolling still reset the destination under the curtain', async () => {
  const h = harness({ reduced: true, smooth: false })
  h.render('old', { state: 'blocked', proceed() {} })
  assert.equal(h.tweens[0].properties.duration, 0)
  h.tweens[0].complete()
  h.window.scrollY = 0
  h.render('new', { state: 'unblocked' })
  await until(() => h.tweens.length === 2)
  assert.equal(h.window.scrollY, 0)
  assert.equal(h.tweens[1].properties.duration, 0)
  h.tweens[1].complete()
  assert.equal(h.root.pointerEvents, 'none')
})

test('offscreen lazy images do not hold navigation; failed images also release it', async () => {
  const images = [
    { loading: 'lazy', getBoundingClientRect: () => ({ top: 1600, bottom: 1800 }), decode: () => assert.fail('Offscreen lazy image was requested') },
    { loading: 'eager', decode: () => Promise.reject(new Error('404')) },
  ]
  const h = harness({ images })
  await h.readiness.waitForPageAssets({ querySelectorAll: () => images }, new AbortController().signal)
})

test('stalled resources have a deadline and aborted navigation stops waiting immediately', async () => {
  const h = harness({ fonts: new Promise(() => {}) })
  const controller = new AbortController()
  const waiting = h.readiness.waitForPageAssets(null, controller.signal)
  controller.abort()
  await assert.rejects(waiting, { name: 'AbortError' })
  await h.readiness.waitForPageAssets(null, new AbortController().signal)
})
