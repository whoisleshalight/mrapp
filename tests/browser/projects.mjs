// Run after npm run build: npm run test:browser:projects
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { existsSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'

const browserPath = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
].find(existsSync)
assert.ok(browserPath, 'Chrome or Edge is required')
const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', 'preview', '--host', '127.0.0.1', '--port', '4188', '--strictPort'], { windowsHide: true, stdio: 'ignore' })
const browser = spawn(browserPath, ['--headless=new', '--disable-gpu', '--no-first-run', '--remote-debugging-port=9288', `--user-data-dir=${mkdtempSync(join(tmpdir(), 'mr-projects-'))}`, 'about:blank'], { windowsHide: true, stdio: 'ignore' })
let socket, id = 0
const calls = new Map()
const exceptions = []
const command = (method, params = {}) => new Promise((resolve, reject) => {
  const key = ++id
  calls.set(key, { resolve, reject })
  socket.send(JSON.stringify({ id: key, method, params }))
})
const evaluate = async (expression) => {
  const result = await command('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })
  if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails))
  return result.result.value
}
async function until(callback, label) {
  const deadline = Date.now() + 15000
  while (Date.now() < deadline) {
    try { if (await callback()) return } catch { /* Wait for browser/server startup. */ }
    await delay(100)
  }
  throw new Error(`Timed out: ${label}`)
}
const cards = `document.querySelectorAll('main article a[aria-label]')`
const firstCard = `${cards}[0]`
const imageMotion = `${firstCard}.querySelector('img').parentElement`
async function settled(path) {
  await until(() => evaluate(`location.pathname === '${path}' && document.querySelector('main section') && !document.querySelector('[inert]') && !document.querySelector('[role="status"]')`), `route ${path}`)
}
async function screenshot(name) {
  if (!process.env.MR_PROJECT_SCREENSHOTS) return
  const result = await command('Page.captureScreenshot', { format: 'png' })
  writeFileSync(join(process.env.MR_PROJECT_SCREENSHOTS, name), Buffer.from(result.data, 'base64'))
}

try {
  await until(async () => (await fetch('http://127.0.0.1:4188')).ok, 'preview')
  let target
  await until(async () => { target = (await (await fetch('http://127.0.0.1:9288/json/list')).json()).find(t => t.type === 'page'); return !!target }, 'browser')
  socket = new WebSocket(target.webSocketDebuggerUrl)
  await new Promise((resolve, reject) => { socket.addEventListener('open', resolve, { once: true }); socket.addEventListener('error', reject, { once: true }) })
  socket.addEventListener('message', ({ data }) => {
    const message = JSON.parse(data)
    if (message.method === 'Runtime.exceptionThrown') exceptions.push(message.params.exceptionDetails)
    const call = calls.get(message.id)
    if (call) { calls.delete(message.id); message.error ? call.reject(message.error) : call.resolve(message.result) }
  })
  await command('Runtime.enable')
  await command('Page.enable')
  await command('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false })
  await command('Page.navigate', { url: 'http://127.0.0.1:4188/projects' })
  await settled('/projects')
  assert.equal(await evaluate(`${cards}.length`), 4)
  await evaluate(`window.scrollTo(0, ${firstCard}.getBoundingClientRect().top + scrollY - 180)`)
  await until(() => evaluate(`[...${cards}].slice(0, 2).every(a => a.querySelector('img').naturalWidth > 0)`), 'local cover images')
  await delay(700)
  const sizes = await evaluate(`[...${cards}].map(a => ({width:a.clientWidth,height:a.clientHeight}))`)
  assert.deepEqual(sizes.map(a => a.width), [347, 460, 347, 460])
  assert.ok(sizes[0].height > sizes[0].width && sizes[1].width > sizes[1].height)
  console.log('PASS centered cards, alternating proportions, local images')

  const initialTransform = await evaluate(`getComputedStyle(${imageMotion}).transform`)
  await evaluate('window.scrollBy(0, 200)')
  await delay(800)
  assert.notEqual(await evaluate(`getComputedStyle(${imageMotion}).transform`), initialTransform)
  assert.equal(await evaluate(`(() => {const image=${firstCard}.querySelector('img').getBoundingClientRect();const card=${firstCard}.getBoundingClientRect();return image.top<=card.top && image.bottom>=card.bottom})()`), true)
  await evaluate(`window.scrollTo(0, ${firstCard}.getBoundingClientRect().top + scrollY - 180)`)
  await delay(800)
  const center = await evaluate(`(() => {const r=${firstCard}.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()`)
  await command('Input.dispatchMouseEvent', { type: 'mouseMoved', ...center })
  await delay(500)
  assert.equal(await evaluate(`getComputedStyle(${firstCard}.querySelector('h3')).opacity`), '1')
  await screenshot('projects-desktop.png')
  await command('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 20, y: 150 })
  await evaluate(`${firstCard}.focus()`)
  assert.equal(await evaluate(`${firstCard}.matches(':focus-visible')`), true)
  await delay(500)
  assert.equal(await evaluate(`getComputedStyle(${firstCard}.querySelector('h3')).opacity`), '1')
  console.log('PASS scroll parallax stays inside the frame; hover and keyboard show titles')

  await evaluate(`window.__cardsMarker = true; ${firstCard}.click()`)
  await until(() => evaluate(`location.pathname === '/projects/sample-project' && !document.querySelector('[inert]')`), 'project navigation')
  assert.equal(await evaluate('window.__cardsMarker'), true)
  assert.equal(await evaluate('document.querySelector("main h1").textContent'), 'Muse')
  await evaluate('history.back()')
  await settled('/projects')
  console.log('PASS entire card opens its project without a reload; Back restores the archive')

  await command('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true })
  await command('Emulation.setTouchEmulationEnabled', { enabled: true })
  await delay(700)
  await evaluate(`window.scrollTo(0, ${firstCard}.getBoundingClientRect().top + scrollY - 160)`)
  await delay(700)
  assert.equal(await evaluate(`[...${cards}].every(a => {const r=a.getBoundingClientRect();return r.left>=0 && r.right<=innerWidth})`), true)
  assert.equal(await evaluate(`getComputedStyle(${firstCard}.querySelector('h3')).opacity`), '1')
  await screenshot('projects-mobile.png')
  console.log('PASS mobile: cards fit the viewport and titles are visible without hover')

  await command('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] })
  await delay(500)
  const reducedTransform = await evaluate(`getComputedStyle(${imageMotion}).transform`)
  await evaluate('window.scrollBy(0, 200)')
  await delay(500)
  assert.equal(await evaluate(`getComputedStyle(${imageMotion}).transform`), reducedTransform)
  assert.equal(await evaluate(`getComputedStyle(${firstCard}.querySelector('h3')).transitionDuration`), '0s')
  await evaluate(`document.querySelector('a[href="/"]').click()`)
  await settled('/')
  assert.equal(await evaluate(`${cards}.length`), 4)
  assert.equal(await evaluate(`document.querySelector('#featured-projects-title').textContent.trim()`), 'Selected works')
  assert.deepEqual(exceptions, [])
  console.log('PASS reduced motion, home section and no uncaught browser exceptions')
} finally {
  if (socket?.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify({ id: ++id, method: 'Browser.close' }))
    socket.close()
  }
  browser.kill()
  server.kill()
}
