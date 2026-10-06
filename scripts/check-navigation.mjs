// Windows browser smoke check; run: node --experimental-websocket scripts/check-navigation.mjs
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { existsSync, mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'

const browserPath = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
].find(existsSync)
if (!browserPath) throw new Error('Chrome or Edge is required for this smoke check.')
const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', 'preview', '--host', '127.0.0.1', '--port', '4187', '--strictPort'], { windowsHide: true, stdio: 'ignore' })
const browser = spawn(browserPath, ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check', '--remote-debugging-port=9287', `--user-data-dir=${mkdtempSync(join(tmpdir(), 'mr-navigation-'))}`, 'about:blank'], { windowsHide: true, stdio: 'ignore' })
let socket
let id = 0
const calls = new Map()
const exceptions = []

async function until(callback, label) {
  const deadline = Date.now() + 15000
  while (Date.now() < deadline) {
    try { if (await callback()) return } catch { /* server/browser may still be starting */ }
    await delay(50)
  }
  throw new Error(`Timed out: ${label}`)
}

function command(method, params = {}) {
  return new Promise((resolve, reject) => {
    const callId = ++id
    calls.set(callId, { resolve, reject })
    socket.send(JSON.stringify({ id: callId, method, params }))
  })
}

async function evaluate(expression) {
  const result = await command('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.text)
  return result.result.value
}

async function settled(path) {
  await until(() => evaluate(`location.pathname === ${JSON.stringify(path)} && !!document.querySelector('main h1') && !document.querySelector('[role="status"]') && !document.querySelector('[inert]') && !window.__activeTransition && (() => { const el = document.querySelector('[data-transition-overlay]'); return el && Math.abs(new DOMMatrix(getComputedStyle(el).transform).m22) < 0.001 })()`), `route settled: ${path}`)
  assert.equal(await evaluate('window.__navigationMarker'), 'same-document')
}

async function click(path) {
  await evaluate(`document.querySelector('a[href="${path}"]').click()`)
}

async function footerReachable(label) {
  try {
    await until(() => evaluate(`(() => {
      // A resize can refresh the scroll range after the first scroll request.
      window.scrollTo(0, document.documentElement.scrollHeight);
      const footer = document.querySelector('footer').getBoundingClientRect();
      return footer.top >= -1 && footer.bottom <= innerHeight + 1;
    })()`), `footer fully visible: ${label}`)
  } catch (error) {
    const bounds = await evaluate(`(() => {
      const footer = document.querySelector('footer').getBoundingClientRect();
      const content = document.querySelector('#smooth-content');
      const wrapper = document.querySelector('#smooth-wrapper');
      return { footerBottom: footer.bottom, viewportHeight: innerHeight, scrollY, scrollHeight: document.documentElement.scrollHeight, contentHeight: content.clientHeight, contentStyle: content.getAttribute('style'), wrapperChildren: wrapper.children.length, bodyStyle: document.body.getAttribute('style'), headerInContent: content.contains(document.querySelector('header')), script: document.querySelector('script[src]')?.src };
    })()`)
    throw new Error(`${error.message}; ${JSON.stringify(bounds)}`, { cause: error })
  }
  await evaluate('window.scrollTo(0, 0)')
  await until(() => evaluate(`Math.abs(document.querySelector('#smooth-content').getBoundingClientRect().top) <= 1`), `scroll reset: ${label}`)
}

try {
  await until(async () => (await fetch('http://127.0.0.1:4187')).ok, 'preview server')
  let target
  await until(async () => {
    const targets = await (await fetch('http://127.0.0.1:9287/json/list')).json()
    target = targets.find((entry) => entry.type === 'page')
    return !!target
  }, 'browser debug target')
  socket = new WebSocket(target.webSocketDebuggerUrl)
  await new Promise((resolve, reject) => { socket.addEventListener('open', resolve, { once: true }); socket.addEventListener('error', reject, { once: true }) })
  socket.addEventListener('message', ({ data }) => {
    const message = JSON.parse(data)
    if (message.method === 'Runtime.exceptionThrown') exceptions.push(message.params.exceptionDetails)
    const call = calls.get(message.id)
    if (call) { calls.delete(message.id); if (message.error) call.reject(new Error(message.error.message)); else call.resolve(message.result) }
  })
  await command('Runtime.enable')
  await command('Page.enable')
  await command('Page.navigate', { url: 'http://127.0.0.1:4187/' })
  await until(() => evaluate('!!document.querySelector("main h1") && !document.querySelector("[role=status]")'), 'initial preloader completes')
  await evaluate(`
    window.__navigationMarker = 'same-document';
    window.__transitionCount = 0;
    window.__nativeStart = document.startViewTransition.bind(document);
    document.startViewTransition = (update) => {
      window.__transitionCount++;
      const transition = window.__nativeStart(update);
      window.__activeTransition = transition;
      transition.finished.then(() => {
        if (window.__activeTransition === transition) window.__activeTransition = null;
      });
      return transition;
    };
  `)
  assert.equal(await evaluate('document.querySelector("[inert]") === null'), true)
  console.log('PASS startup: preloader finishes and releases the site')

  await footerReachable('home')
  assert.equal(await evaluate(`document.querySelector('#smooth-wrapper').children.length`), 1)
  assert.equal(await evaluate(`getComputedStyle(document.querySelector('#smooth-wrapper')).position`), 'fixed')
  assert.notEqual(await evaluate(`getComputedStyle(document.querySelector('#smooth-content')).transform`), 'none')
  console.log('PASS ScrollSmoother: wrapper, content transform and native scroll driver are active')

  await click('/about')
  await until(() => evaluate(`location.pathname === '/about' && !!document.querySelector('[inert]') && getComputedStyle(document.documentElement, '::view-transition-new(root)').animationDuration === '0.8s'`), 'native page reveal starts after route commit')
  await delay(200)
  const snapshot = await evaluate(`({
    clip: getComputedStyle(document.documentElement, '::view-transition-new(root)').clipPath,
    dim: getComputedStyle(document.documentElement, '::view-transition-old(root)').filter,
    curtain: new DOMMatrix(getComputedStyle(document.querySelector('[data-transition-overlay]')).transform).m22
  })`)
  assert.match(snapshot.clip, /^inset\(/)
  assert.ok(Number.parseFloat(snapshot.clip.slice(6)) > 0, 'the new page is still partly clipped')
  assert.ok(Number.parseFloat(snapshot.dim.slice(11)) < 1, 'the old page darkens')
  assert.equal(snapshot.curtain, 0, 'the solid curtain stays hidden during native transitions')
  await settled('/about')
  await until(() => evaluate('document.activeElement.id === "main-content"'), 'focus restored after transition')
  console.log('PASS native transition: 0.8s bottom-up reveal, old page dims, focus moves, no reload')

  await click('/contacts')
  await until(() => evaluate(`location.pathname === '/contacts' && !!window.__activeTransition && getComputedStyle(document.documentElement, '::view-transition-new(root)').animationDuration === '0.75s'`), 'contact ellipse reveal')
  assert.match(await evaluate(`getComputedStyle(document.documentElement, '::view-transition-new(root)').clipPath`), /^ellipse\(/)
  await settled('/contacts')
  assert.equal(await evaluate('document.querySelector("footer")'), null)
  assert.equal(await evaluate('document.querySelector("[data-contact-video]").muted'), true)
  assert.equal(await evaluate('getComputedStyle(document.querySelector("[data-contact-video]")).objectFit'), 'cover')
  assert.equal(await evaluate(`(() => { const video = document.querySelector('[data-contact-video]').getBoundingClientRect(); return Math.abs(video.width - document.documentElement.clientWidth) < 1 && video.height >= innerHeight - 1 })()`), true)
  await evaluate(`document.querySelector('button[aria-label="Pause background video"]')?.click()`)
  assert.equal(await evaluate('document.querySelector("[data-contact-video]").paused'), true)
  console.log('PASS contacts: curved reveal, full-screen video, pause control, no footer')

  await click('/projects')
  await settled('/projects')
  await click('/projects/sample-project')
  await settled('/projects/sample-project')
  await evaluate('history.back()')
  await settled('/projects')
  await evaluate('history.forward()')
  await settled('/projects/sample-project')
  console.log('PASS projects and browser Back/Forward')

  await click('/')
  await settled('/')
  assert.equal(await evaluate(`getComputedStyle(document.querySelector('main section')).opacity`), '1')
  console.log('PASS incoming section content stays visible after the snapshot finishes')
  await click('/projects')
  await settled('/projects')
  await click('/projects/sample-project')
  await settled('/projects/sample-project')
  await footerReachable('project')
  for (const [width, height] of [[1000, 400], [390, 640]]) {
    await command('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false })
    await footerReachable(`project at ${width}x${height}`)
  }
  await command('Emulation.clearDeviceMetricsOverride')
  await footerReachable('project after resizing')
  console.log('PASS footer is fully reachable on home, project and narrow/resized viewports')
  const beforeHash = await evaluate('window.__transitionCount')
  await evaluate('history.pushState(null, "", "#section")')
  assert.equal(await evaluate('location.hash'), '#section')
  assert.equal(await evaluate('window.__transitionCount'), beforeHash)
  console.log('PASS hash navigation')

  await click('/about')
  await until(() => evaluate(`location.pathname === '/about' && !!window.__activeTransition && !!document.querySelector('[inert]')`), 'interruptible native transition')
  await evaluate('window.__activeTransition.skipTransition()')
  await settled('/about')
  console.log('PASS skipped native animation releases the site')

  await evaluate('document.startViewTransition = undefined')
  await click('/projects')
  await delay(100)
  assert.equal(await evaluate('location.pathname'), '/about')
  await settled('/projects')
  console.log('PASS curtain fallback covers the old page before route change')
  await evaluate(`document.startViewTransition = (update) => {
    window.__transitionCount++;
    const transition = window.__nativeStart(update);
    window.__activeTransition = transition;
    transition.finished.then(() => { window.__activeTransition = null; });
    return transition;
  }`)

  await command('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] })
  await until(() => evaluate(`getComputedStyle(document.querySelector('#smooth-wrapper')).position !== 'fixed' && getComputedStyle(document.querySelector('#smooth-content')).transform === 'none'`), 'ScrollSmoother disables for reduced motion')
  const beforeReduced = await evaluate('window.__transitionCount')
  await click('/contacts')
  await settled('/contacts')
  assert.equal(await evaluate('document.querySelector("footer")'), null)
  assert.equal(await evaluate('document.querySelector("[data-contact-video]").paused'), true)
  assert.equal(await evaluate('window.__transitionCount'), beforeReduced)
  console.log('PASS reduced motion navigation')

  await command('Page.navigate', { url: 'http://127.0.0.1:4187/projects/missing-project' })
  await until(() => evaluate('document.querySelector("main h1")?.textContent === "404" && !document.querySelector("[role=status]")'), 'direct unknown slug')
  console.log('PASS direct nested URL, unknown slug, reduced motion preloader')
  assert.deepEqual(exceptions, [])
  console.log('PASS no uncaught browser exceptions')
} finally {
  if (socket?.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify({ id: ++id, method: 'Browser.close' }))
    socket.close()
  }
  browser.kill()
  server.kill()
}
