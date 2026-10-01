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
  await until(() => evaluate(`location.pathname === ${JSON.stringify(path)} && !!document.querySelector('main h1') && !document.querySelector('[role="status"]') && (() => { const el = document.querySelector('[data-transition-overlay]'); return el && Math.abs(new DOMMatrix(getComputedStyle(el).transform).m22) < 0.001 })()`), `route settled: ${path}`)
  assert.equal(await evaluate('window.__navigationMarker'), 'same-document')
}

async function click(path) {
  await evaluate(`document.querySelector('a[href="${path}"]').click()`)
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
  await evaluate('window.__navigationMarker = "same-document"')
  assert.equal(await evaluate('document.querySelector("[inert]") === null'), true)
  console.log('PASS startup: preloader finishes and releases the site')

  await click('/about')
  await delay(100)
  assert.equal(await evaluate('location.pathname'), '/')
  await settled('/about')
  await until(() => evaluate('document.activeElement.id === "main-content"'), 'focus restored after transition')
  console.log('PASS transition: exit precedes route change, focus moves, no reload')

  await click('/projects')
  await settled('/projects')
  await click('/projects/sample-project')
  await settled('/projects/sample-project')
  await evaluate('history.back()')
  await settled('/projects')
  await evaluate('history.forward()')
  await settled('/projects/sample-project')
  console.log('PASS projects and browser Back/Forward')

  await click('/blog')
  await settled('/blog')
  await click('/blog/first-post')
  await settled('/blog/first-post')
  await evaluate('history.pushState(null, "", "#section")')
  assert.equal(await evaluate('location.hash'), '#section')
  console.log('PASS blog archive, article, hash navigation')

  await command('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] })
  await click('/contact')
  await settled('/contact')
  console.log('PASS reduced motion navigation')

  await command('Page.navigate', { url: 'http://127.0.0.1:4187/blog/missing-post' })
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
