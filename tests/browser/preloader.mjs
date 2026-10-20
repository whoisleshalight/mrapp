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
const settled = () => until(() => evaluate('!!document.querySelector("main h1") && !document.querySelector("[data-preloader]") && !document.querySelector("[inert]") && document.body.style.overflow !== "hidden"'), 'startup releases the site')
async function screenshot(name) {
  const shot = await command('Page.captureScreenshot', { format: 'png' })
  writeFileSync(join(artifacts, name + '.png'), Buffer.from(shot.data, 'base64'))
}
async function orbit() {
  return evaluate(`(() => {
    const gl = document.querySelector('[data-preloader] canvas').getContext('webgl');
    const program = gl.getParameter(gl.CURRENT_PROGRAM);
    return Array.from(gl.getUniform(program, gl.getUniformLocation(program, 'orbit')));
  })()`)
}
async function holdHeroImage() {
  await command('Network.setCacheDisabled', { cacheDisabled: true })
  await command('Fetch.enable', { patterns: [{ urlPattern: '*gesture-*.jpg', requestStage: 'Request' }] })
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
    if (message.method === 'Fetch.requestPaused') held.add(message.params.requestId)
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
  assert.deepEqual(await orbit(), [0, 0])
  await command('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 1300, y: 780 })
  await until(async () => { const [yaw, pitch] = await orbit(); return yaw > 0.1 && pitch > 0.1 }, 'mouse orbits the camera right and down')
  await screenshot('desktop-pointer')
  await command('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 140, y: 120 })
  await until(async () => { const [yaw, pitch] = await orbit(); return yaw < -0.1 && pitch < -0.1 }, 'mouse orbits the camera left and up')
  await evaluate(`window.dispatchEvent(new PointerEvent('pointerout', {relatedTarget: null}))`)
  await until(async () => (await orbit()).every((angle) => Math.abs(angle) < 0.02), 'camera returns to neutral when the mouse leaves')
  await screenshot('desktop')
  await releaseHeroImage()
  await settled()
  const progress = await evaluate('window.__progress')
  assert.equal(progress.at(-1), 100)
  assert.ok(progress.every((value, index) => index === 0 || value >= progress[index - 1]), 'Progress must never run backwards')
  await evaluate(`window.__sameDocument = true; document.querySelector('a[href="/projects"]').click()`)
  await until(() => evaluate('location.pathname === "/projects" && !document.querySelector("[inert]")'), 'navigation')
  assert.equal(await evaluate('window.__sameDocument && !document.querySelector("[data-preloader]")'), true)
  console.log('PASS desktop mouse orbit and return to neutral, real critical-image progress, keyboard/scroll lock, monotonic counter, one startup per document')

  await command('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true })
  await holdHeroImage()
  await command('Page.navigate', { url: 'http://127.0.0.1:4193/about' })
  await until(() => held.size > 0, 'mobile image held')
  await delay(1900)
  await command('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 350, y: 740 })
  await delay(100)
  assert.deepEqual(await orbit(), [0, 0], 'Narrow viewports must not orbit in response to pointer input')
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

  await command('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false })
  await holdHeroImage()
  await command('Page.navigate', { url: 'http://127.0.0.1:4193/about' })
  await until(() => held.size > 0, 'stalled image')
  await settled()
  assert.ok(await evaluate('window.__progress.at(-1) < 100'), 'Timeout must not fabricate completion')
  await releaseHeroImage(true)
  console.log('PASS stalled asset deadline releases the site without a fabricated 100%')
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
