// Run after npm run build: npm run test:browser:home
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
const origin = 'http://127.0.0.1:4191'
const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', 'preview', '--host', '127.0.0.1', '--port', '4191', '--strictPort'], { windowsHide: true, stdio: 'ignore' })
const browser = spawn(browserPath, ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check', '--remote-debugging-port=9290', `--user-data-dir=${mkdtempSync(join(tmpdir(), 'mr-home-'))}`, 'about:blank'], { windowsHide: true, stdio: 'ignore' })
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
async function settled(path) {
  await until(() => evaluate(`location.pathname === ${JSON.stringify(path)} && document.querySelector('main > *') && !document.querySelector('[inert]') && !document.querySelector('[role="status"]')`), `route ${path}`)
}
async function scrollTo(y) {
  await evaluate(`window.scrollTo(0, ${y})`)
  await until(() => evaluate(`Math.abs(document.querySelector('#smooth-content').getBoundingClientRect().top + scrollY) < 0.5`), 'smooth content reaches the requested scroll position')
  // The scrubbed text tween can trail the completed smooth scroll briefly.
  await delay(300)
}
async function screenshot(name) {
  if (!process.env.MR_HOME_SCREENSHOTS) return
  const result = await command('Page.captureScreenshot', { format: 'png' })
  writeFileSync(join(process.env.MR_HOME_SCREENSHOTS, name), Buffer.from(result.data, 'base64'))
}
const statement = `document.querySelector('[data-studio-statement]')`
const lines = `document.querySelectorAll('[data-statement-line]')`
const specialties = `document.querySelector('[data-specialties]')`
const specialtyStage = `document.querySelector('[data-specialties-stage]')`
const words = `document.querySelectorAll('[data-specialty-word]')`
const noOverflow = `document.documentElement.scrollWidth <= innerWidth + 1`
const transforms = (elements) => `[...${elements}].map(element => {const m=new DOMMatrix(getComputedStyle(element).transform);return [m.m11,m.m22,m.m41,m.m42]})`
async function statementDiagnostics() {
  return evaluate(`(async () => {
    const module=await import(document.querySelector('script[type="module"]').src);
    const triggers=Object.values(module).find(value=>typeof value?.getAll==='function' && typeof value?.refresh==='function');
    return {
      scrollY,
      contentTop:document.querySelector('#smooth-content').getBoundingClientRect().top,
      lineTops:[...${lines}].map(line=>line.getBoundingClientRect().top+scrollY),
      transforms:${transforms(lines)},
      triggers:triggers?.getAll().filter(trigger=>trigger.trigger?.hasAttribute('data-statement-line')).map(trigger=>({start:trigger.start,end:trigger.end,progress:trigger.progress,text:trigger.trigger.textContent})),
    };
  })()`)
}
async function assertStatement(label) {
  assert.equal(await evaluate(`${lines}.length`), 5)
  assert.equal(await evaluate(`${statement}.closest('.pin-spacer') === null && ${statement}.querySelector('.pin-spacer') === null`), true, 'the studio statement remains in natural page flow')
  const bounds = await evaluate(`({tops:[...${lines}].map(line=>line.getBoundingClientRect().top+scrollY),viewport:innerHeight})`)
  const entrance = bounds.tops[0] - bounds.viewport * 0.9
  await scrollTo(entrance)
  assert.equal(await evaluate(`(() => {const style=getComputedStyle(${lines}[0]);return Number(style.opacity)===1 && style.visibility==='visible'})()`), true, 'the first statement line starts visible')
  const initial = await evaluate(transforms(lines))
  const initialDiagnostics = await statementDiagnostics()
  await screenshot(`home-${label}-statement-enter.png`)
  await scrollTo(bounds.tops[2] - bounds.viewport * 0.45)
  const revealed = await evaluate(transforms(lines))
  assert.ok(initial.some((matrix, index) => matrix.some((value, axis) => Math.abs(value - revealed[index][axis]) > 0.02)), `${label}: scrolling measurably expands or moves the statement text`)
  assert.equal(await evaluate(`Number(getComputedStyle(${lines}[0]).opacity)===1`), true, 'the first statement line stays visible throughout the reveal')
  assert.equal(await evaluate(noOverflow), true, `${label}: text motion stays inside the page width`)
  await screenshot(`home-${label}-statement-reveal.png`)
  await scrollTo(bounds.tops[4] - bounds.viewport * 0.4)
  assert.equal(await evaluate(`[...${lines}].every(line => {const style=getComputedStyle(line);return Number(style.opacity)===1 && style.visibility==='visible'})`), true, 'all five lines are readable after entering the viewport')
  assert.equal(await evaluate(`[...${lines}].every(line => {const r=line.getBoundingClientRect();return r.left>=-1 && r.right<=innerWidth+1})`), true, 'fully revealed statement lines fit without clipping letters')
  await scrollTo(entrance)
  try {
    await until(async () => {
      const reversed = await evaluate(transforms(lines))
      return initial.every((matrix,index)=>matrix.every((value,axis)=>Math.abs(value-reversed[index][axis])<1))
    }, 'reverse scrolling restores the initial text layout')
  } catch (error) {
    throw new Error(`${error.message}; ${JSON.stringify({entrance,bounds,initial:initialDiagnostics,reversed:await statementDiagnostics()})}`, {cause:error})
  }
  const detailTop = await evaluate(`document.querySelector('[data-statement-detail]').getBoundingClientRect().top + scrollY`)
  await scrollTo(detailTop - bounds.viewport * 0.15)
  await until(() => evaluate(`document.querySelector('[data-statement-image]')?.complete && document.querySelector('[data-statement-image]').naturalWidth > 0`), 'local statement image')
  assert.equal(await evaluate(`document.querySelector('[data-statement-note]').textContent.trim().length > 20 && document.querySelector('[data-statement-detail]').textContent.trim().length > 20`), true, 'supporting studio text is present')
  assert.equal(await evaluate(noOverflow), true)
  await screenshot(`home-${label}-statement-detail.png`)
}
async function assertSpecialties(label) {
  assert.equal(await evaluate(`${words}.length`), 3)
  await until(() => evaluate(`!!${specialtyStage}?.closest('.pin-spacer')`), `${label} specialties pin`)
  const viewport = await evaluate('innerHeight')
  await scrollTo(0)
  assert.equal(await evaluate(`(() => {const r=document.querySelector('[data-specialties-label]').getBoundingClientRect();return r.top>=0 && r.bottom<=innerHeight})()`), true, 'the specialties label appears in the first screen')
  await screenshot(`home-${label}-hero.png`)
  const initial = await evaluate(transforms(words))
  await scrollTo(viewport * 0.6)
  const expanded = await evaluate(transforms(words))
  assert.ok(initial.some((matrix, index) => matrix.some((value, axis) => Math.abs(value - expanded[index][axis]) > 0.02)), `${label}: specialties expand from the bottom of the hero while scrolling`)
  assert.equal(await evaluate(noOverflow), true, `${label}: specialties create no page overflow`)
  await screenshot(`home-${label}-specialties.png`)
  const pin = await evaluate(`(() => {const stage=${specialtyStage};const spacer=stage.closest('.pin-spacer');return {start:spacer.getBoundingClientRect().top+scrollY-innerHeight*.14,distance:spacer.offsetHeight-stage.offsetHeight}})()`)
  await scrollTo(pin.start + pin.distance * 0.25)
  const before = await evaluate(`${specialtyStage}.getBoundingClientRect().top`)
  await scrollTo(pin.start + pin.distance * 0.75)
  const after = await evaluate(`${specialtyStage}.getBoundingClientRect().top`)
  assert.ok(Math.abs(before-after)<3 && Math.abs(after-viewport*.14)<3, 'expanded specialties remain pinned while scrolling')
  const heroBottom = await evaluate(`${specialtyStage}.closest('section').getBoundingClientRect().bottom+scrollY`)
  await scrollTo(heroBottom - viewport * 0.8)
  const initialOpacity = await evaluate(`Number(getComputedStyle(${words}[0].parentElement).opacity)`)
  await scrollTo(heroBottom - viewport * 0.3)
  const finalOpacity = await evaluate(`Number(getComputedStyle(${words}[0].parentElement).opacity)`)
  const fadeDiagnostics = await evaluate(`({scrollY,heroRect:${specialtyStage}.closest('section').getBoundingClientRect().toJSON(),stageRect:${specialtyStage}.getBoundingClientRect().toJSON(),spacerHeight:${specialtyStage}.closest('.pin-spacer').offsetHeight})`)
  assert.ok(initialOpacity>finalOpacity, `the specialties fade as the visitor scrolls past the hero: ${JSON.stringify({initialOpacity,finalOpacity,heroBottom,viewport,pin,...fadeDiagnostics})}`)
  for (const progress of [0.5, 0.75, 1.3]) {
    await scrollTo(viewport * progress)
    await screenshot(`home-${label}-hero-scroll-${progress}.png`)
  }
}
async function assertReduced(label) {
  await command('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] })
  await until(() => evaluate(`!document.querySelector('.pin-spacer') && getComputedStyle(document.querySelector('#smooth-content')).transform === 'none'`), `${label} reduced-motion cleanup`)
  assert.equal(await evaluate(`[...${lines},...${words}].every(element => {const style=getComputedStyle(element);const r=element.getBoundingClientRect();return Number(style.opacity)===1 && style.visibility==='visible' && r.left>=-1 && r.right<=innerWidth+1})`), true, `${label}: all reduced-motion words stay readable inside the viewport`)
  const before = await evaluate(`({lines:${transforms(lines)},words:${transforms(words)}})`)
  await scrollTo(await evaluate(`${statement}.getBoundingClientRect().top + scrollY`))
  await screenshot(`home-${label}-reduced.png`)
  await scrollTo(await evaluate('scrollY + 250'))
  assert.deepEqual(await evaluate(`({lines:${transforms(lines)},words:${transforms(words)}})`), before, 'reduced-motion text stays static while scrolling')
  assert.equal(await evaluate(noOverflow), true)
}

try {
  await until(async () => (await fetch(origin)).ok, 'preview server')
  let target
  await until(async () => { target = (await (await fetch('http://127.0.0.1:9290/json/list')).json()).find(item => item.type === 'page'); return !!target }, 'browser target')
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
  await evaluate('document.fonts.ready')
  await evaluate(`[...document.querySelectorAll('button')].find(button=>button.textContent.trim()==='OK')?.click()`)
  await delay(250)
  await until(() => evaluate(`!!${statement} && !!${specialtyStage}`), 'new home sections')
  await evaluate(`window.__homeMarker = 'same-document'`)
  assert.equal(await evaluate(`document.querySelectorAll('main h1').length`), 1, 'the home hero has one semantic page heading')
  assert.equal(await evaluate(`!!(${specialties}.compareDocumentPosition(document.querySelector('[data-featured-stage]')) & Node.DOCUMENT_POSITION_FOLLOWING) && !!(document.querySelector('[data-featured-stage]').compareDocumentPosition(${statement}) & Node.DOCUMENT_POSITION_FOLLOWING)`), true, 'the home sections follow hero, selected works, studio statement')
  await assertSpecialties('desktop')
  await assertStatement('desktop')
  console.log('PASS desktop home: specialties expand on scroll; five visible statement lines animate in natural flow with loaded detail image and no overflow')

  await evaluate(`document.querySelector('a[href="/projects"]').click()`)
  await settled('/projects')
  assert.equal(await evaluate(`document.querySelectorAll('.pin-spacer').length`), 0, 'all home pins are removed on route exit')
  assert.equal(await evaluate(`document.querySelector('[data-studio-statement]') === null && document.querySelector('[data-specialties]') === null`), true)
  await evaluate('history.back()')
  await settled('/')
  assert.equal(await evaluate('window.__homeMarker'), 'same-document')
  await until(() => evaluate(`document.querySelectorAll('.pin-spacer').length === 2 && !!${specialtyStage}.closest('.pin-spacer') && !!document.querySelector('[data-featured-stage]').closest('.pin-spacer')`), 'home pins restored after Back')
  console.log('PASS route exit removes home pins and Back restores both sections without a reload')

  await assertReduced('desktop')
  await scrollTo(0)
  await command('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true })
  await command('Emulation.setTouchEmulationEnabled', { enabled: true })
  await delay(900)
  await assertReduced('mobile')
  await command('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'no-preference' }] })
  await until(() => evaluate(`document.querySelectorAll('.pin-spacer').length === 2`), 'mobile animations restored')
  await assertSpecialties('mobile')
  await assertStatement('mobile')
  console.log('PASS mobile home and live reduced-motion changes: readable static text, measured scroll motion and no horizontal page overflow')

  await scrollTo(await evaluate('document.documentElement.scrollHeight'))
  await until(() => evaluate(`(() => {window.scrollTo(0,document.documentElement.scrollHeight);const r=document.querySelector('footer').getBoundingClientRect();return r.top>=-1 && r.bottom<=innerHeight+1})()`), 'footer reachable after all home sections')
  assert.deepEqual(exceptions, [])
  console.log('PASS footer remains reachable and no uncaught browser exceptions')
} finally {
  if (socket?.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify({ id: ++id, method: 'Browser.close' }))
    socket.close()
  }
  browser.kill()
  server.kill()
}
