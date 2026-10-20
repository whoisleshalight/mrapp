import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { existsSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'

const browserPath = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(existsSync)
if (!browserPath) throw new Error('Chrome or Edge is required.')
const artifacts = mkdtempSync(join(tmpdir(), 'mr-preloader-'))
const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', 'preview', '--host', '127.0.0.1', '--port', '4193', '--strictPort'], { windowsHide: true, stdio: 'ignore' })
const browser = spawn(browserPath, ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check', '--remote-debugging-port=9293', `--user-data-dir=${join(artifacts, 'profile')}`, 'about:blank'], { windowsHide: true, stdio: 'ignore' })
let socket
let id = 0
const calls = new Map()
const held = new Set()
const requests = new Map()
const exceptions = []

async function until(callback, label, duration = 15000) {
  const deadline = Date.now() + duration
  while (Date.now() < deadline) {
    try { if (await callback()) return } catch { /* Waiting for the browser/server. */ }
    await delay(40)
  }
  throw new Error(`Timed out: ${label}`)
}
function command(method, params = {}) {
  return new Promise((resolve, reject) => {
    calls.set(++id, { resolve, reject })
    socket.send(JSON.stringify({ id, method, params }))
  })
}
async function evaluate(expression) {
  const result = await command('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })
  if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails))
  return result.result.value
}
const settled = async () => {
  try {
    await until(() => evaluate('!!document.querySelector("main h1") && !document.querySelector("[data-preloader]") && !document.querySelector("[inert]") && document.body.style.overflow !== "hidden"'), 'startup releases the site')
  } catch (error) {
    console.log('Startup diagnostic', await evaluate(`({phase:document.querySelector('[data-preloader]')?.getAttribute('data-phase'),progress:window.__progress,overflow:document.body.style.overflow,document:document.readyState,pending:[...document.images].filter(img=>!img.complete).map(img=>img.src)})`), exceptions)
    throw error
  }
}
async function screenshot(name) {
  const shot = await command('Page.captureScreenshot', { format: 'png' })
  writeFileSync(join(artifacts, name + '.png'), Buffer.from(shot.data, 'base64'))
}
async function holdHeroImage(pattern = '*gesture-*.jpg') {
  await command('Network.setCacheDisabled', { cacheDisabled: true })
  await command('Fetch.enable', { patterns: [{ urlPattern: pattern, requestStage: 'Request' }] })
}
async function releaseHeroImage(fail = false) {
  for (const requestId of held) {
    await command(fail ? 'Fetch.failRequest' : 'Fetch.continueRequest', { requestId, ...(fail ? { errorReason: 'Failed' } : {}) })
  }
  held.clear()
  await command('Fetch.disable')
}

try {
  await until(async () => (await fetch('http://127.0.0.1:4193')).ok, 'preview')
  let target
  await until(async () => {
    target = (await (await fetch('http://127.0.0.1:9293/json/list')).json()).find((entry) => entry.type === 'page')
    return !!target
  }, 'debug target')
  socket = new WebSocket(target.webSocketDebuggerUrl)
  await new Promise((resolve, reject) => { socket.addEventListener('open', resolve, { once: true }); socket.addEventListener('error', reject, { once: true }) })
  socket.addEventListener('message', ({ data }) => {
    const message = JSON.parse(data)
    if (message.method === 'Runtime.exceptionThrown') exceptions.push(message.params.exceptionDetails)
    if (message.method === 'Fetch.requestPaused') {
      held.add(message.params.requestId)
      requests.set(message.params.requestId, message.params.request.url)
    }
    const call = calls.get(message.id)
    if (call) { calls.delete(message.id); if (message.error) call.reject(new Error(message.error.message)); else call.resolve(message.result) }
  })
  await command('Runtime.enable')
  await command('Page.enable')
  await command('Network.enable')
  await command('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false })
  await command('Page.addScriptToEvaluateOnNewDocument', { source: `
    window.__progress = [];
    new MutationObserver(() => {
      const loader = document.querySelector('[data-preloader]');
      if (loader) {
        const value = Number(loader.querySelector('canvas + div + div span').textContent);
        if (window.__progress.at(-1) !== value) window.__progress.push(value);
      }
    }).observe(document, {subtree: true, childList: true, characterData: true});
  ` })

  await holdHeroImage()
  await command('Page.navigate', { url: 'http://127.0.0.1:4193/about' })
  await until(() => held.size > 0, 'held critical image')
  await until(() => evaluate('document.querySelector("[data-preloader]")?.dataset.renderer === "webgl"'), 'WebGL text spheres')
  await delay(2000)
  assert.equal(await evaluate('document.querySelector("[data-preloader]").dataset.phase'), 'loading')
  assert.ok(await evaluate('window.__progress.at(-1) < 100'))
  assert.equal(await evaluate('document.body.style.overflow'), 'hidden')
  assert.equal(await evaluate('[...document.querySelectorAll("a, button")].every(el => !!el.closest("[inert]"))'), true)
  await screenshot('desktop')
  await releaseHeroImage()
  await settled()
  const progress = await evaluate('window.__progress')
  assert.equal(progress.at(-1), 100)
  assert.ok(progress.every((value, index) => index === 0 || value >= progress[index - 1]), 'Progress must never run backwards')
  await evaluate(`window.__sameDocument = true; document.querySelector('a[href="/projects"]').click()`)
  await until(() => evaluate('location.pathname === "/projects" && !document.querySelector("[inert]")'), 'navigation')
  assert.equal(await evaluate('window.__sameDocument && !document.querySelector("[data-preloader]")'), true)
  console.log('PASS desktop spheres, real critical-image progress, keyboard/scroll lock, monotonic counter, one startup per document')

  // Reproduce refreshing midway through parallax cards, rather than only testing the page top.
  await evaluate(`(() => {
    const card = document.querySelector('main article');
    window.scrollTo(0, card.getBoundingClientRect().top + scrollY + 150);
  })()`)
  await delay(800)
  const restoredPosition = await evaluate('scrollY')
  assert.ok(restoredPosition > 300)
  await command('Page.reload', { ignoreCache: true })
  await until(() => evaluate('document.querySelector("[data-preloader]")?.dataset.phase === "exiting"'), 'parallax prepared before preloader exit')
  const parallax = () => evaluate(`(() => {
    const image = document.querySelector('main article img');
    const bounds = image.getBoundingClientRect();
    return {top: bounds.top, width: bounds.width, transform: getComputedStyle(image.parentElement).transform, scroll: scrollY};
  })()`)
  const behindLoader = await parallax()
  assert.notEqual(behindLoader.transform, 'none', 'Parallax is already initialized while the loader still covers the page')
  assert.ok(Math.abs(behindLoader.scroll - restoredPosition) < 2, 'Reload restores the previous scroll position')
  await settled()
  await delay(300)
  const revealed = await parallax()
  assert.ok(Math.abs(revealed.top - behindLoader.top) < 1, `Photo jumped at reveal: ${JSON.stringify({behindLoader, revealed})}`)
  assert.ok(Math.abs(revealed.width - behindLoader.width) < 1, `Photo width changed at reveal: ${JSON.stringify({behindLoader, revealed})}`)
  assert.ok(Math.abs(revealed.scroll - restoredPosition) < 2)
  console.log('PASS mid-page reload: parallax is prepared behind the loader and photo position stays stable after reveal')

  await command('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true })
  await holdHeroImage()
  await command('Page.navigate', { url: 'http://127.0.0.1:4193/about' })
  await until(() => held.size > 0, 'mobile image held')
  await delay(1900)
  await screenshot('mobile')
  assert.equal(await evaluate('document.documentElement.scrollWidth <= innerWidth'), true)
  await command('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] })
  await until(() => evaluate('!document.querySelector("[data-preloader]")?.hasAttribute("data-renderer")'), 'motion preference removes the animated renderer')
  assert.equal(await evaluate('!!document.querySelector("[data-preloader]")'), true, 'Changing motion preferences must still wait for assets')
  assert.equal(await evaluate('document.querySelector("[data-preloader]").hasAttribute("data-renderer")'), false)
  await releaseHeroImage(true)
  await settled()
  console.log('PASS mobile layout, dynamic reduced motion still waits for assets, failed image releases startup')

  await command('Page.navigate', { url: 'http://127.0.0.1:4193/contacts' })
  await settled()
  assert.equal(await evaluate('document.querySelector("video").paused'), true)
  console.log('PASS direct contacts with reduced motion does not wait for a paused video')

  await command('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'no-preference' }] })
  const fallback = await command('Page.addScriptToEvaluateOnNewDocument', { source: `
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function(type, ...args) {
      return type.startsWith('webgl') ? null : original.call(this, type, ...args);
    };
  ` })
  await command('Page.navigate', { url: 'http://127.0.0.1:4193/' })
  await settled()
  await command('Page.removeScriptToEvaluateOnNewDocument', { identifier: fallback.identifier })
  console.log('PASS unavailable WebGL falls back and completes startup')

  const extraResources = await command('Page.addScriptToEvaluateOnNewDocument', { source: `
    document.addEventListener('DOMContentLoaded', () => {
      const script = document.createElement('script');
      script.src = '/startup-check.js';
      script.async = true;
      document.head.append(script);
      const style = document.createElement('link');
      style.rel = 'stylesheet';
      style.href = '/startup-check.css';
      document.head.append(style);
    }, {once: true});
  ` })
  await command('Fetch.enable', { patterns: [{ urlPattern: '*startup-check.*', requestStage: 'Request' }] })
  await command('Page.navigate', { url: 'http://127.0.0.1:4193/' })
  await until(() => held.size === 2, 'async script and stylesheet held')
  await until(() => evaluate('!!document.querySelector("[data-preloader]")'), 'loader during pending scripts/styles')
  assert.notEqual(await evaluate('document.readyState'), 'complete')
  const scriptRequest = [...held].find((requestId) => requests.get(requestId).endsWith('.js'))
  const styleRequest = [...held].find((requestId) => requests.get(requestId).endsWith('.css'))
  await command('Fetch.fulfillRequest', { requestId: scriptRequest, responseCode: 200, responseHeaders: [{name: 'Content-Type', value: 'text/javascript'}], body: Buffer.from('window.__startupScriptReady = true;').toString('base64') })
  held.delete(scriptRequest)
  await until(() => evaluate('window.__startupScriptReady === true'), 'async script executes')
  assert.equal(await evaluate('document.querySelector("[data-preloader]").dataset.phase'), 'loading')
  await command('Fetch.fulfillRequest', { requestId: styleRequest, responseCode: 200, responseHeaders: [{name: 'Content-Type', value: 'text/css'}], body: Buffer.from('body { --startup-style-ready: 1; }').toString('base64') })
  held.clear()
  await command('Fetch.disable')
  await settled()
  assert.equal(await evaluate('getComputedStyle(document.body).getPropertyValue("--startup-style-ready").trim()'), '1')
  await command('Page.removeScriptToEvaluateOnNewDocument', { identifier: extraResources.identifier })
  console.log('PASS pending async scripts and stylesheets keep the loader active until execution/load completes')

  await command('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false })
  await holdHeroImage('*packaging-*.jpg')
  await command('Page.navigate', { url: 'http://127.0.0.1:4193/about' })
  await until(() => held.size > 0, 'below-fold lazy image requested eagerly')
  await delay(8500)
  assert.equal(await evaluate('document.querySelector("[data-preloader]")?.dataset.phase'), 'loading')
  assert.ok(await evaluate('window.__progress.at(-1) < 100'), 'Pending resources must never fabricate completion')
  assert.equal(await evaluate('[...document.images].every(image => image.loading === "eager")'), true)
  await releaseHeroImage()
  await settled()
  assert.equal(await evaluate('window.__progress.at(-1)'), 100)
  console.log('PASS below-fold lazy images are loaded eagerly and keep startup active beyond the former 8-second deadline')
  await command('Fetch.enable', { patterns: [{ urlPattern: '*AboutPage-*.js', requestStage: 'Request' }] })
  await command('Page.navigate', { url: 'http://127.0.0.1:4193/about' })
  await until(() => held.size > 0, 'lazy route chunk intercepted')
  await releaseHeroImage(true)
  await settled()
  assert.equal(await evaluate('document.querySelector("header")'), null)
  console.log('PASS failed lazy route reveals the error page and releases startup')
  assert.deepEqual(exceptions, [])
  console.log('PASS no uncaught browser exceptions')
  console.log(`Screenshots: ${artifacts}`)
} finally {
  if (socket?.readyState === WebSocket.OPEN) { socket.send(JSON.stringify({ id: ++id, method: 'Browser.close' })); socket.close() }
  browser.kill()
  server.kill()
}
