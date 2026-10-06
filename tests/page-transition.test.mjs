import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { setImmediate as tick } from 'node:timers/promises'
import { runInNewContext } from 'node:vm'
import test from 'node:test'
import ts from 'typescript'

function load(file, imports, environment) {
  const exports = {}
  const { outputText } = ts.transpileModule(readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  })
  runInNewContext(outputText, {
    exports,
    require: (name) => {
      assert.ok(name in imports, 'Unexpected import: ' + name)
      return { __esModule: true, ...imports[name] }
    },
    AbortController, setTimeout, clearTimeout, console,
    ...environment,
  }, { filename: file })
  return exports
}

const deferred = () => {
  let resolve
  const promise = new Promise((done) => { resolve = done })
  return { promise, resolve }
}

function harness({ reduced = false, native = true, video = null } = {}) {
  const classes = new Set()
  const root = {}
  const tweens = []
  const states = []
  const snapshots = []
  let refreshes = 0
  let queries = 0
  let predicate
  const document = {
    documentElement: {
      classList: {
        add: (...names) => names.forEach((name) => classes.add(name)),
        remove: (...names) => names.forEach((name) => classes.delete(name)),
      },
    },
    querySelector: () => { queries++; return video },
  }
  if (native) document.startViewTransition = (update) => {
    const ready = deferred()
    const finished = deferred()
    const snapshot = {
      ready: ready.promise,
      finished: finished.promise,
      skips: 0,
      async begin() { await update(); ready.resolve() },
      complete: finished.resolve,
      skipTransition() { this.skips++; finished.resolve() },
    }
    snapshots.push(snapshot)
    return snapshot
  }
  const environment = { document, window: { setTimeout } }
  const media = load('src/app/components/PageTransition/contactMedia.ts', {}, environment)
  const setReady = (value) => states.push(value)
  const refs = []
  const hooks = []
  const effects = []
  const layoutEffects = []
  let cursor = 0
  let currentKey = 'initial'
  let blocker = { state: 'unblocked' }
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
    'react-router': {
      useLocation: () => ({ key: currentKey }),
      useBlocker: (callback) => { predicate = callback; return blocker },
    },
    '../../../shared/animation/gsap': {
      gsap: {
        set: (element, properties) => Object.assign(element, properties),
        to: (element, properties) => {
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
      },
      ScrollTrigger: { refresh: () => { refreshes++ } },
    },
    '../../config/motion': {
      motion: { transitionDuration: 0.8, ease: 'power3.inOut' },
      prefersReducedMotion: () => reduced,
    },
    './PageTransition.module.scss': {
      default: { overlay: 'overlay', nativeTransition: 'native', contactTransition: 'contact' },
    },
    '../../../shared/animation/readiness': { TransitionReadinessContext: {} },
    './contactMedia': media,
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
  return {
    render, classes, root, tweens, states, snapshots,
    block(path, proceed = () => {}) {
      render(currentKey, { state: 'blocked', location: { pathname: path }, proceed })
    },
    unmount() { hooks.forEach((hook) => hook?.cleanup?.()) },
    get predicate() { return predicate },
    get refreshes() { return refreshes },
    get queries() { return queries },
  }
}

test('contacts and its legacy URL wait for a video frame before revealing; completion releases navigation', async () => {
  for (const path of ['/contacts', '/contact', '/contacts/']) {
    const video = Object.assign(new EventTarget(), { readyState: 0, error: null })
    const h = harness({ video })
    let proceeded = 0
    h.block(path, () => { proceeded++ })
    assert.equal(proceeded, 0, 'The old snapshot must be captured before changing routes')
    assert.deepEqual([...h.classes], ['native', 'contact'])
    const commit = h.snapshots[0].begin()
    assert.equal(proceeded, 1)
    assert.deepEqual(h.states, [false])
    h.render('contact-route', { state: 'unblocked' })
    let committed = false
    void commit.then(() => { committed = true })
    await tick()
    assert.equal(committed, false, 'A black initial video frame must not become the snapshot')
    video.readyState = 2
    video.dispatchEvent(new Event('loadeddata'))
    await commit
    h.snapshots[0].complete()
    await tick()
    assert.equal(h.states.at(-1), true)
    assert.equal(h.classes.size, 0)
    assert.equal(h.refreshes, 1)
    assert.equal(h.root.scaleY, 0)
    h.unmount()
  }
})

test('ordinary routes retain their transition and do not wait for the contact video', async () => {
  const h = harness()
  h.block('/about')
  assert.deepEqual([...h.classes], ['native'])
  const commit = h.snapshots[0].begin()
  h.render('about-route', { state: 'unblocked' })
  await commit
  assert.equal(h.queries, 0)
  h.snapshots[0].complete()
  await tick()
  assert.equal(h.states.at(-1), true)
  h.unmount()
})

test('a second navigation cancels the old video wait without releasing the newer transition', async () => {
  const video = Object.assign(new EventTarget(), { readyState: 0, error: null })
  const h = harness({ video })
  h.block('/contacts')
  const firstCommit = h.snapshots[0].begin()
  h.render('contact-route', { state: 'unblocked' })
  h.block('/projects')
  assert.equal(h.snapshots[0].skips, 1)
  await firstCommit
  await tick()
  assert.equal(h.states.at(-1), false)
  const secondCommit = h.snapshots[1].begin()
  h.render('projects-route', { state: 'unblocked' })
  await secondCommit
  h.snapshots[1].complete()
  await tick()
  assert.equal(h.states.at(-1), true)
  assert.equal(h.refreshes, 1, 'Only the current transition may finish')
  assert.equal(h.classes.size, 0)
  h.unmount()
})

test('unmounting a contact route aborts its frame wait and clears the snapshot classes', async () => {
  const h = harness({ video: Object.assign(new EventTarget(), { readyState: 0 }) })
  h.block('/contacts')
  const commit = h.snapshots[0].begin()
  h.render('contact-route', { state: 'unblocked' })
  h.unmount()
  await commit
  assert.equal(h.classes.size, 0)
  assert.equal(h.states.at(-1), true)
})

test('reduced motion skips snapshots; the fallback covers the old page before committing', () => {
  for (const reduced of [true, false]) {
    const h = harness({ reduced, native: reduced })
    let proceeded = false
    h.block('/contacts', () => { proceeded = true })
    assert.equal(h.snapshots.length, 0)
    assert.equal(proceeded, false)
    assert.equal(h.tweens[0].properties.duration, reduced ? 0 : 0.4)
    h.tweens[0].complete()
    assert.equal(proceeded, true)
    assert.equal(h.root.scaleY, 1)
    h.render('contact-route', { state: 'unblocked' })
    h.tweens[1].complete()
    assert.equal(h.root.scaleY, 0)
    assert.equal(h.states.at(-1), true)
    assert.equal(h.classes.size, 0)
    h.unmount()
  }
})

test('hash-only changes do not animate; pathname and search changes do', () => {
  const h = harness()
  const currentLocation = { pathname: '/contacts', search: '', hash: '' }
  assert.equal(h.predicate({ currentLocation, nextLocation: { ...currentLocation, hash: '#email' } }), false)
  assert.equal(h.predicate({ currentLocation, nextLocation: { ...currentLocation, search: '?from=home' } }), true)
  assert.equal(h.predicate({ currentLocation, nextLocation: { ...currentLocation, pathname: '/about' } }), true)
  h.unmount()
})

test('missing, decoded, failed, timed out and aborted videos cannot trap navigation', async () => {
  for (const mode of ['missing', 'decoded', 'failed', 'timeout', 'abort', 'error']) {
    const video = mode === 'missing' ? null : Object.assign(new EventTarget(), {
      readyState: mode === 'decoded' ? 2 : 0,
      error: mode === 'failed' ? new Error('Unavailable') : null,
    })
    const timers = new Map()
    const media = load('src/app/components/PageTransition/contactMedia.ts', {}, {
      document: { querySelector: () => video },
      window: { setTimeout: (callback) => { timers.set(1, callback); return 1 } },
      clearTimeout: (id) => timers.delete(id),
    })
    const controller = new AbortController()
    const waiting = media.waitForContactFrame(controller.signal)
    if (mode === 'timeout') timers.get(1)()
    if (mode === 'abort') controller.abort()
    if (mode === 'error') video.dispatchEvent(new Event('error'))
    await waiting
    assert.equal(timers.size, 0)
  }
})
