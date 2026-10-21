// Run after npm run build: npm run test:browser:pixel
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
const origin = 'http://127.0.0.1:4193'
const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', 'preview', '--host', '127.0.0.1', '--port', '4193', '--strictPort'], { windowsHide: true, stdio: 'ignore' })
const browser = spawn(browserPath, ['--headless=new', '--disable-gpu', '--enable-unsafe-swiftshader', '--no-first-run', '--no-default-browser-check', '--remote-debugging-port=9293', `--user-data-dir=${mkdtempSync(join(tmpdir(), 'mr-pixel-'))}`, 'about:blank'], { windowsHide: true, stdio: 'ignore' })
let socket, id = 0
const calls = new Map(), exceptions = []
const command = (method, params = {}) => new Promise((resolve, reject) => {
  calls.set(++id, { resolve, reject })
  socket.send(JSON.stringify({ id, method, params }))
})
const evaluate = async expression => {
  const result = await command('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })
  if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails))
  return result.result.value
}
async function until(callback, label) {
  const deadline = Date.now() + 20000
  while (Date.now() < deadline) {
    if (await callback()) return
    await delay(100)
  }
  throw new Error(`Timed out: ${label}`)
}
async function settled(path) {
  await until(() => evaluate(`location.pathname === '${path}' && document.querySelector('img[data-pixel-hover]') && !document.querySelector('[inert]') && !document.querySelector('[role="status"]')`), `route ${path}`)
}
const canvas = `document.querySelector('canvas[data-pixel-hover-canvas]')`
async function hover() {
  const point = await evaluate(`(() => {const r=document.querySelector('img[data-pixel-hover]').closest('a').getBoundingClientRect();return {x:r.left+r.width*.5,y:r.top+Math.min(r.height*.5,200)}})()`)
  await command('Input.dispatchMouseEvent', { type: 'mouseMoved', x: point.x - 60, y: point.y })
  for (let step = 0; step < 9; step++) {
    await command('Input.dispatchMouseEvent', { type: 'mouseMoved', x: point.x - 45 + step * 14, y: point.y + Math.sin(step) * 15 })
    await delay(16)
  }
}
async function screenshot(name) {
  if (!process.env.MR_PIXEL_SCREENSHOTS) return
  const result = await command('Page.captureScreenshot', { format: 'png' })
  writeFileSync(join(process.env.MR_PIXEL_SCREENSHOTS, name), Buffer.from(result.data, 'base64'))
}
try {
  await until(async () => { try { return (await fetch(origin)).ok } catch { return false } }, 'preview')
  let target
  await until(async () => { try { target = (await (await fetch('http://127.0.0.1:9293/json/list')).json()).find(t => t.type === 'page'); return !!target } catch { return false } }, 'browser')
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
  await command('Page.bringToFront')
  await command('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 2, mobile: false })
  await command('Page.navigate', { url: `${origin}/projects` })
  await settled('/projects')
  await evaluate(`(async()=>{const entry=await import(document.querySelector('script[type="module"][src]').src);window.__testSmoother=Object.values(entry).find(value=>typeof value?.get==='function'&&typeof value.get()?.scrollTop==='function')})()`)
  assert.equal(await evaluate(`${canvas} === null`), true, 'GPU resources are lazy')
  await evaluate(`window.scrollTo(0, document.querySelector('img[data-pixel-hover]').closest('a').getBoundingClientRect().top + scrollY - 140)`)
  await delay(1200)
  await until(async () => {
    await evaluate(`(() => {let y=0;for(let node=document.querySelector('img[data-pixel-hover]').closest('a');node;node=node.offsetParent)y+=node.offsetTop;const smoother=window.__testSmoother?.get();if(smoother)smoother.scrollTop(y-140);else window.scrollTo(0,y-140)})()`)
    return evaluate(`document.querySelector('img[data-pixel-hover]').closest('a').getBoundingClientRect().top < 300`)
  }, 'photo scrolled into view')
  await screenshot('pixel-rest.png')
  await hover()
  await until(() => evaluate(`${canvas}?.style.display === 'block'`), 'visible displacement')
  const pixels = await evaluate(`(() => {
    const c=${canvas}, gl=c.getContext('webgl');
    gl.drawArrays(gl.TRIANGLES,0,6);
    const pixels=new Uint8Array(c.width*c.height*4);
    gl.readPixels(0,0,c.width,c.height,gl.RGBA,gl.UNSIGNED_BYTE,pixels);
    let affected=0; for(let i=3;i<pixels.length;i+=4) if(pixels[i]>0) affected++;
    const image=c.previousElementSibling.getBoundingClientRect(), layer=c.getBoundingClientRect();
    return {affected,total:c.width*c.height,ratioX:c.width/parseFloat(c.style.width),ratioY:c.height/parseFloat(c.style.height),aligned:Math.abs(image.top-layer.top)<1&&Math.abs(image.left-layer.left)<1&&Math.abs(image.height-layer.height)<1,error:gl.getError()};
  })()`)
  assert.equal(pixels.error, 0)
  assert.ok(pixels.affected > 100 && pixels.affected < pixels.total * .5, 'shader changes a local patch of photo pixels')
  assert.ok(pixels.total <= 8_400_000, 'render resolution is bounded')
  assert.ok(pixels.ratioX >= 1.99 && pixels.ratioY >= 1.99, 'displaced blocks retain the photo resolution on HiDPI screens')
  assert.ok(pixels.aligned, 'layer follows the existing photo parallax')
  await screenshot('pixel-hover.png')
  await command('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 20, y: 140 })
  await until(() => evaluate(`${canvas}?.style.display === 'none'`), 'trail settles back to the original photo')
  await command('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false })
  await hover()
  assert.equal(await evaluate(`(() => {const c=${canvas};return c.width===Math.round(parseFloat(c.style.width))&&c.height===Math.round(parseFloat(c.style.height))})()`), true, 'resolution updates when the display density changes without a layout resize')
  console.log('PASS real WebGL pixels, HiDPI quality, density changes, bounded resolution, parallax alignment and trail decay')

  await command('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] })
  await until(() => evaluate(`${canvas} === null`), 'reduced motion releases resources')
  await hover()
  assert.equal(await evaluate(`${canvas} === null`), true)
  await command('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'no-preference' }] })
  await hover()
  await until(() => evaluate(`${canvas}?.style.display === 'block'`), 'hover restored')
  await evaluate(`document.querySelector('img[data-pixel-hover]').closest('a').click()`)
  await until(() => evaluate(`location.pathname === '/projects/sample-project' && !document.querySelector('[inert]')`), 'project link')
  assert.equal(await evaluate(`${canvas} === null`), true, 'route cleanup removes canvases')
  await evaluate('history.back()')
  await settled('/projects')
  console.log('PASS reduced motion toggling, project navigation, canvas cleanup and Back')

  await command('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true })
  await command('Emulation.setTouchEmulationEnabled', { enabled: true })
  await hover()
  assert.equal(await evaluate(`${canvas} === null`), true, 'touch devices keep native images')
  await command('Emulation.setTouchEmulationEnabled', { enabled: false })
  await command('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false })
  await evaluate(`document.querySelector('a[href="/"]').click()`)
  await settled('/')
  await evaluate(`window.scrollTo(0, document.querySelector('[data-featured-stage]').closest('.pin-spacer').getBoundingClientRect().top + scrollY + 1100)`)
  await delay(1500)
  await hover()
  await until(() => evaluate(`${canvas}?.style.display === 'block'`), 'Selected works hover')
  await screenshot('pixel-featured.png')
  await command('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] })
  await until(() => evaluate(`${canvas} === null`), 'home cleanup')
  await evaluate(`HTMLCanvasElement.prototype.getContext = new Proxy(HTMLCanvasElement.prototype.getContext, {apply(target,self,args){return args[0]==='webgl'?null:Reflect.apply(target,self,args)}})`)
  await command('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'no-preference' }] })
  await delay(1000)
  await hover()
  assert.equal(await evaluate(`${canvas} === null`), true, 'no WebGL keeps native images')
  assert.deepEqual(exceptions, [])
  console.log('PASS touch fallback, Selected works hover, no-WebGL fallback and no uncaught exceptions')
} finally {
  if (socket?.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify({ id: ++id, method: 'Browser.close' }))
    socket.close()
  }
  browser.kill()
  server.kill()
}
