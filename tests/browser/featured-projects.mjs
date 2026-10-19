// Run after npm run build: node --experimental-websocket tests/browser/featured-projects.mjs
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
const origin = 'http://127.0.0.1:4189'
const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', 'preview', '--host', '127.0.0.1', '--port', '4189', '--strictPort'], { windowsHide: true, stdio: 'ignore' })
const browser = spawn(browserPath, ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check', '--remote-debugging-port=9289', `--user-data-dir=${mkdtempSync(join(tmpdir(), 'mr-featured-'))}`, 'about:blank'], { windowsHide: true, stdio: 'ignore' })
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
    try { if (await callback()) return } catch { /* Browser and lazy routes may still be starting. */ }
    await delay(100)
  }
  throw new Error(`Timed out: ${label}`)
}
const stage = `document.querySelector('[data-featured-stage]')`
const track = `document.querySelector('[data-featured-track]')`
const projects = `document.querySelectorAll('[data-featured-project]')`
const oneGalleryPin = `${stage}?.closest('section')?.querySelectorAll('.pin-spacer').length === 1`
const link = (index) => `${projects}[${index}].querySelector('a')`
async function settled(path) {
  await until(() => evaluate(`location.pathname === ${JSON.stringify(path)} && document.querySelector('main > *') && !document.querySelector('[inert]') && !document.querySelector('[role="status"]')`), `route ${path}`)
}
async function scrollTo(y) {
  await evaluate(`window.scrollTo(0, ${y})`)
  // ScrollSmoother and the scrubbed timeline both need to reach the requested position.
  await delay(900)
}
async function pinBounds() {
  return evaluate(`(() => {
    const stage = ${stage};
    const spacer = stage.closest('.pin-spacer');
    return spacer && {
      start: spacer.getBoundingClientRect().top + scrollY,
      distance: spacer.offsetHeight - stage.offsetHeight,
      height: stage.offsetHeight,
    };
  })()`)
}
async function sample(bounds, progress) {
  await scrollTo(bounds.start + bounds.distance * progress)
  return evaluate(`(() => {
    const stage = ${stage}.getBoundingClientRect();
    return {
      x: new DOMMatrix(getComputedStyle(${track}).transform).m41,
      top: stage.top,
      height: stage.height,
      viewport: innerHeight,
      overflow: document.documentElement.scrollWidth - innerWidth,
    };
  })()`)
}
async function revealProject(index, bounds) {
  let low = 0, high = 1
  let progress = 0.5
  for (let attempt = 0; attempt < 10; attempt++) {
    await scrollTo(bounds.start + bounds.distance * progress)
    const rect = await evaluate(`(() => {const r=${link(index)}.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2,width:r.width,height:r.height,viewport:innerWidth}})()`)
    if (Math.abs(rect.x - rect.viewport / 2) < 15 && rect.y > 0 && rect.y < bounds.height) return rect
    if (rect.x > rect.viewport / 2) low = progress
    else high = progress
    progress = (low + high) / 2
  }
  assert.fail(`Project ${index} cannot be reached by scrolling the gallery`)
}
async function screenshot(name) {
  if (!process.env.MR_FEATURED_SCREENSHOTS) return
  const result = await command('Page.captureScreenshot', { format: 'png' })
  writeFileSync(join(process.env.MR_FEATURED_SCREENSHOTS, name), Buffer.from(result.data, 'base64'))
}
async function assertAnimatedGallery(label) {
  await until(() => evaluate(`${stage}?.dataset.animated === 'true' && !!${stage}.closest('.pin-spacer')`), `${label} pin`)
  await scrollTo(0)
  const bounds = await pinBounds()
  assert.ok(bounds.distance > bounds.height, `${label}: scrolling has enough room for the horizontal gallery`)
  const samples = []
  for (const progress of [0.15, 0.5, 0.85]) samples.push(await sample(bounds, progress))
  assert.ok(samples[0].x > samples[1].x && samples[1].x > samples[2].x, `${label}: projects move left as the page scrolls`)
  assert.ok(samples[0].x - samples[2].x > 500, `${label}: the track traverses the viewport`)
  assert.ok(samples.every(value => Math.abs(value.top) < 3 && Math.abs(value.height - value.viewport) < 3), `${label}: the section stays pinned to the full viewport`)
  assert.ok(samples.every(value => value.overflow <= 1), `${label}: the track creates no document overflow`)
  await revealProject(3, bounds)
  await until(() => evaluate(`[...document.querySelectorAll('[data-featured-image]')].every(image => image.complete && image.naturalWidth > 0)`), `${label} project cover images`)
  await screenshot(`featured-${label}-last.png`)
  await sample(bounds, 0.9999)
  assert.equal(await evaluate(`(() => {const r=${link(3)}.getBoundingClientRect();return Math.abs(r.x+r.width/2-innerWidth/2)<3})()`), true, `${label}: the final project stays centered at the end of the pin`)
  await screenshot(`featured-${label}-end.png`)
  return { bounds, samples }
}

try {
  await until(async () => (await fetch(origin)).ok, 'preview server')
  let target
  await until(async () => { target = (await (await fetch('http://127.0.0.1:9289/json/list')).json()).find(item => item.type === 'page'); return !!target }, 'browser target')
  socket = new WebSocket(target.webSocketDebuggerUrl)
  await new Promise((resolve, reject) => { socket.addEventListener('open', resolve, { once: true }); socket.addEventListener('error', reject, { once: true }) })
  socket.addEventListener('message', ({ data }) => {
    const message = JSON.parse(data)
    if (message.method === 'Runtime.exceptionThrown') exceptions.push(message.params.exceptionDetails)
    const call = calls.get(message.id)
    if (call) { calls.delete(message.id); message.error ? call.reject(new Error(message.error.message)) : call.resolve(message.result) }
  })
  await command('Runtime.enable')
  await command('Page.enable')
  await command('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false })
  await command('Page.navigate', { url: `${origin}/` })
  await settled('/')
  await evaluate(`window.__featuredMarker = 'same-document'`)
  assert.equal(await evaluate(`${projects}.length`), 4)
  assert.equal(await evaluate(`document.querySelector('#featured-projects-title').textContent.trim()`), 'Selected works')
  const projectLinks = await evaluate(`[...${projects}].map(project => {const a=project.querySelector('a');return {path:a.getAttribute('href'),name:a.getAttribute('aria-label'),title:project.querySelector('h3').textContent}})`)
  assert.deepEqual(projectLinks.map(project => project.path), ['/projects/sample-project', '/projects/forma', '/projects/prism', '/projects/monument'])
  for (const [index, title] of ['Muse', 'Forma', 'Prism', 'Monument'].entries()) {
    assert.ok(projectLinks[index].name.includes(title), 'each project link has a descriptive accessible name')
    assert.ok(projectLinks[index].title.includes(title), 'each project has a visible semantic title')
  }
  const desktop = await assertAnimatedGallery('desktop')
  console.log('PASS desktop: semantic heading, four accessible project links, local covers and pinned horizontal motion')

  await revealProject(0, desktop.bounds)
  await screenshot('featured-desktop-first.png')
  await command('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 })
  await command('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 })
  await evaluate(`${link(0)}.focus({preventScroll:true})`)
  assert.equal(await evaluate(`${link(0)}.matches(':focus-visible')`), true)
  for (let index = 1; index < 4; index++) {
    await command('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 })
    await command('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 })
    await delay(600)
    assert.equal(await evaluate(`document.activeElement === ${link(index)}`), true, 'Tab follows the project order')
    assert.equal(await evaluate(`(() => {const r=${link(index)}.getBoundingClientRect();return r.left>=-1 && r.right<=innerWidth+1 && r.top>=-1 && r.bottom<=innerHeight+1})()`), true, 'Tab reveals each offscreen project inside the viewport')
  }
  await evaluate(`${link(0)}.focus({preventScroll:true})`)
  await command('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 })
  await command('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 })
  await settled('/projects/sample-project')
  assert.equal(await evaluate(`document.querySelector('main h1').textContent`), 'Muse')
  assert.equal(await evaluate(`document.querySelectorAll('.pin-spacer').length`), 0, 'the home pin is removed on route navigation')
  assert.equal(await evaluate('window.__featuredMarker'), 'same-document')
  await evaluate('history.back()')
  await settled('/')
  await until(() => evaluate(oneGalleryPin), 'one gallery pin after Back')
  console.log('PASS Tab reveals every offscreen project; Enter navigation, Back and pin cleanup without a page reload')

  for (let visit = 0; visit < 2; visit++) {
    await evaluate(`document.querySelector('a[href="/projects"]').click()`)
    await settled('/projects')
    assert.equal(await evaluate(`document.querySelectorAll('.pin-spacer').length`), 0)
    await evaluate(`document.querySelector('a[href="/"]').click()`)
    await settled('/')
    await until(() => evaluate(oneGalleryPin), 'one gallery pin after returning home')
  }
  console.log('PASS repeated route visits create one gallery pin and remove it on exit')

  await scrollTo(0)
  await command('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true })
  await command('Emulation.setTouchEmulationEnabled', { enabled: true })
  await delay(900)
  const mobile = await assertAnimatedGallery('mobile')
  await revealProject(0, mobile.bounds)
  await screenshot('featured-mobile-first.png')
  console.log('PASS mobile: full viewport pin, horizontal travel, loaded covers and no page overflow')

  await command('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] })
  await until(() => evaluate(`${stage}?.dataset.animated !== 'true' && !document.querySelector('.pin-spacer') && getComputedStyle(document.querySelector('#smooth-content')).transform === 'none'`), 'reduced motion natural flow')
  assert.equal(await evaluate(`[...${projects}].every(project => {const r=project.getBoundingClientRect();return r.left>=-1 && r.right<=innerWidth+1})`), true)
  const reducedX = await evaluate(`new DOMMatrix(getComputedStyle(${track}).transform).m41`)
  for (let index = 0; index < 4; index++) {
    await evaluate(`${link(index)}.focus()`)
    assert.equal(await evaluate(`document.activeElement === ${link(index)}`), true)
    assert.equal(await evaluate(`(() => {const r=${link(index)}.getBoundingClientRect();return r.top>=-1 && r.bottom<=innerHeight+1})()`), true, 'each reduced-motion project can be reached with keyboard focus')
  }
  await scrollTo(await evaluate(`${stage}.getBoundingClientRect().top + scrollY`))
  await screenshot('featured-mobile-reduced.png')
  await scrollTo(await evaluate('scrollY + 200'))
  assert.equal(await evaluate(`new DOMMatrix(getComputedStyle(${track}).transform).m41`), reducedX)
  assert.equal(await evaluate('document.documentElement.scrollWidth <= innerWidth + 1'), true)
  console.log('PASS reduced motion: static grid, all project links reachable and no animated track or stale pin')

  await command('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'no-preference' }] })
  await until(() => evaluate(`${stage}?.dataset.animated === 'true' && (${oneGalleryPin})`), 'gallery animation restored after preference change')
  await scrollTo(await evaluate('document.documentElement.scrollHeight'))
  await until(() => evaluate(`(() => {window.scrollTo(0,document.documentElement.scrollHeight);const r=document.querySelector('footer').getBoundingClientRect();return r.top>=-1 && r.bottom<=innerHeight+1})()`), 'footer reachable after gallery')
  assert.deepEqual(exceptions, [])
  console.log('PASS motion preference restores the gallery pin, footer remains reachable and no uncaught browser exceptions')
} finally {
  if (socket?.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify({ id: ++id, method: 'Browser.close' }))
    socket.close()
  }
  browser.kill()
  server.kill()
}
