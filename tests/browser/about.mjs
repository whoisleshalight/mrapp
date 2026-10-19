// Run after npm run build: npm run test:browser:about
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
const origin = 'http://127.0.0.1:4192'
const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', 'preview', '--host', '127.0.0.1', '--port', '4192', '--strictPort'], { windowsHide: true, stdio: 'ignore' })
const browser = spawn(browserPath, ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check', '--remote-debugging-port=9292', `--user-data-dir=${mkdtempSync(join(tmpdir(), 'mr-about-'))}`, 'about:blank'], { windowsHide: true, stdio: 'ignore' })
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
  await until(() => evaluate(`location.pathname === ${JSON.stringify(path)} && document.querySelector('main > *') && !document.querySelector('[inert]') && !document.querySelector('[role="status"]') && !window.__activeAboutTransition`), `route ${path}`)
}
async function scrollTo(y) {
  const target = await evaluate(`(() => {
    const target=Math.max(0, Math.min(${y}, document.documentElement.scrollHeight-innerHeight));
    window.scrollTo({top:target,behavior:'instant'});
    return target;
  })()`)
  await until(() => evaluate(`Math.abs(scrollY-${target})<1 && Math.abs(document.querySelector('#smooth-content').getBoundingClientRect().top+scrollY)<0.5`), 'smooth content reaches the requested position')
  await delay(300)
}
async function screenshot(name) {
  if (!process.env.MR_ABOUT_SCREENSHOTS) return
  const result = await command('Page.captureScreenshot', { format: 'png' })
  writeFileSync(join(process.env.MR_ABOUT_SCREENSHOTS, name), Buffer.from(result.data, 'base64'))
}
async function press(key, code, windowsVirtualKeyCode) {
  await command('Input.dispatchKeyEvent', { type: 'keyDown', key, code, windowsVirtualKeyCode })
  await command('Input.dispatchKeyEvent', { type: 'keyUp', key, code, windowsVirtualKeyCode })
}
async function fontsAndCookies() {
  await evaluate('document.fonts.ready')
  await evaluate(`[...document.querySelectorAll('button')].find(button=>button.textContent.trim()==='OK')?.click()`)
  await delay(250)
}
async function footerReachable(label) {
  await scrollTo(await evaluate('document.documentElement.scrollHeight'))
  await until(() => evaluate(`(() => {
    window.scrollTo({top:document.documentElement.scrollHeight,behavior:'instant'});
    const r=document.querySelector('footer').getBoundingClientRect();
    return r.top>=-1 && r.bottom<=innerHeight+1;
  })()`), `${label} footer is fully reachable`)
}

const about = `document.querySelector('[data-about-page]')`
const sections = `document.querySelectorAll('[data-about-section]')`
const passages = `document.querySelectorAll('[data-about-passage]')`
const services = `document.querySelectorAll('[data-about-service]')`
const reveals = `document.querySelectorAll('[data-about-reveal]')`
const philosophyLines = `document.querySelectorAll('[data-about-philosophy] h2 > span')`
const images = `document.querySelectorAll('[data-about-image]')`
const aboutLink = `document.querySelector('header nav a[href="/about"]')`
const noOverflow = `document.documentElement.scrollWidth <= innerWidth + 1`
const transformState = (elements) => `[...${elements}].map(element=>{const m=new DOMMatrix(getComputedStyle(element).transform);return [m.m11,m.m22,m.m41,m.m42]})`
async function mobileViewport(label) {
  const state=await evaluate(`({
    width:innerWidth,clientWidth:document.documentElement.clientWidth,scrollWidth:document.documentElement.scrollWidth,
    links:[...document.querySelectorAll('header a')].map(link=>{const r=link.getBoundingClientRect();return {text:link.textContent.trim(),left:r.left,right:r.right}}),
  })`)
  assert.equal(state.width,390,`${label}: overflow must not expand the mobile layout viewport; ${JSON.stringify(state)}`)
  assert.ok(state.clientWidth<=390 && state.scrollWidth<=391,`${label}: the page fits the actual 390px device width; ${JSON.stringify(state)}`)
  assert.ok(state.links.every(link=>link.left>=-1 && link.right<=391),`${label}: every header link fits the mobile device; ${JSON.stringify(state.links)}`)
}
async function pinBounds(selector) {
  return evaluate(`(() => {
    const stage=document.querySelector(${JSON.stringify(selector)});
    const spacer=stage?.closest('.pin-spacer');
    return spacer && {start:spacer.getBoundingClientRect().top+scrollY,distance:spacer.offsetHeight-stage.offsetHeight};
  })()`)
}
async function pinnedSequence(stageSelector, targets, count, label) {
  await scrollTo(0)
  const bounds = await pinBounds(stageSelector)
  assert.ok(bounds?.distance > 0, `${label}: the scroll sequence has a pin range`)
  const active = [], tops = [], samples = []
  for (const progress of [0.08, 0.28, 0.5, 0.72, 0.92]) {
    await scrollTo(bounds.start + bounds.distance * progress)
    const sample = await evaluate(`(() => {
      const opacity=[...${targets}].map(element=>{
        const details=[element,...element.querySelectorAll('[data-service-media],[data-service-description]')];
        return Math.min(...details.map(detail=>Number(getComputedStyle(detail).opacity)));
      });
      return {opacity,top:document.querySelector(${JSON.stringify(stageSelector)}).getBoundingClientRect().top};
    })()`)
    tops.push(sample.top)
    samples.push({progress,...sample})
    if (Math.max(...sample.opacity)>0.2) active.push(sample.opacity.indexOf(Math.max(...sample.opacity)))
    assert.equal(await evaluate(noOverflow), true, `${label}: pinned content creates no page overflow`)
    if ([0.08, 0.5, 0.92].includes(progress)) await screenshot(`about-${label}-${progress}.png`)
  }
  assert.equal(new Set(active).size, count, `${label}: scrolling reveals every passage or service; ${JSON.stringify(samples)}`)
  assert.ok(active.every((index,position)=>position===0 || index>=active[position-1]), `${label}: the content follows its reading order`)
  assert.ok(Math.max(...tops)-Math.min(...tops)<3, `${label}: the stage stays pinned as its content changes`)
}
async function philosophy(label) {
  assert.equal(await evaluate(`${philosophyLines}.length`), 4)
  assert.ok(await evaluate(`${reveals}.length>=3`))
  const bounds = await evaluate(`({tops:[...${philosophyLines}].map(line=>line.getBoundingClientRect().top+scrollY),viewport:innerHeight})`)
  const entrance = bounds.tops[0]-bounds.viewport*0.9
  await scrollTo(entrance)
  assert.equal(await evaluate(`Number(getComputedStyle(${philosophyLines}[0]).opacity)===1`), true, 'the first philosophy line starts visible')
  const initial = await evaluate(transformState(philosophyLines))
  await scrollTo(bounds.tops[3]-bounds.viewport*0.4)
  const revealed = await evaluate(transformState(philosophyLines))
  assert.ok(initial.some((matrix,index)=>matrix.some((value,axis)=>Math.abs(value-revealed[index][axis])>0.02)), `${label}: philosophy text responds to scroll`)
  assert.equal(await evaluate(`[...${philosophyLines}].every(line=>{const r=line.getBoundingClientRect();return Number(getComputedStyle(line).opacity)===1 && r.left>=-1 && r.right<=innerWidth+1})`), true, 'the complete philosophy headline becomes readable without clipping letters')
  assert.equal(await evaluate(`document.querySelector('[data-about-philosophy]').closest('.pin-spacer')===null`), true, 'the philosophy follows natural document flow')
  assert.equal(await evaluate(noOverflow), true)
  await screenshot(`about-${label}-philosophy.png`)
  await scrollTo(entrance)
  try {
    await until(async () => {
      const reversed = await evaluate(transformState(philosophyLines))
      return initial.every((matrix,index)=>matrix.every((value,axis)=>Math.abs(value-reversed[index][axis])<1))
    }, 'reverse scrolling restores the philosophy text')
  } catch(error) {
    throw new Error(`${error.message}; ${JSON.stringify({entrance,initial,reversed:await evaluate(transformState(philosophyLines)),scrollY:await evaluate('scrollY')})}`,{cause:error})
  }
}
async function loadedImages() {
  assert.ok(await evaluate(`${images}.length>=6`), 'the About photographs and service images are present')
  await until(() => evaluate(`[...${images}].every(image=>image.complete && image.naturalWidth>0)`), 'all About images load')
}
async function naturalServices(label) {
  assert.equal(await evaluate(`document.querySelector('[data-about-services-stage]').closest('.pin-spacer')===null`), true, `${label}: the service list does not pin`)
  let previousTop = -Infinity
  for (let index = 0; index < 3; index++) {
    const top = await evaluate(`${services}[${index}].getBoundingClientRect().top+scrollY`)
    assert.ok(top>previousTop, 'natural service articles have separate positions in reading order')
    previousTop=top
    await scrollTo(top-await evaluate('innerHeight*0.15'))
    assert.equal(await evaluate(`Number(getComputedStyle(${services}[${index}]).opacity)===1 && getComputedStyle(${services}[${index}]).visibility==='visible'`), true, 'each natural-flow service stays visible')
    assert.equal(await evaluate(noOverflow), true)
    await screenshot(`about-${label}-service-${index+1}.png`)
  }
}
async function projects(label) {
  const links = await evaluate(`[...document.querySelectorAll('[data-about-project]')].map(link=>({path:link.getAttribute('href'),name:link.getAttribute('aria-label')||link.textContent.trim()}))`)
  assert.deepEqual(links.map(link=>link.path), ['/projects/sample-project','/projects/forma','/projects/prism','/projects/monument'])
  assert.ok(links.every(link=>link.name.length>1), 'every featured project link has an accessible name')
  await scrollTo(await evaluate(`document.querySelector('[data-about-section="projects"]').getBoundingClientRect().top+scrollY-innerHeight*0.15`))
  assert.equal(await evaluate(noOverflow), true)
  await screenshot(`about-${label}-projects.png`)
}
async function layout(label) {
  assert.equal(await evaluate(`${sections}.length`), 4)
  assert.equal(await evaluate(`${passages}.length`), 3)
  assert.equal(await evaluate(`${services}.length`), 3)
  assert.equal(await evaluate(`document.querySelectorAll('main h1').length`), 1)
  assert.ok(await evaluate(`document.querySelector('main h1').textContent.trim().length>=2`), 'the page has a meaningful semantic heading')
  assert.equal(await evaluate(`[...${services}].every(service=>service.querySelector('h2,h3')?.textContent.trim().length>0)`), true, 'each service has a semantic heading')
  assert.equal(await evaluate(`${about}.textContent.trim().length>200`), true, 'the About content is rendered')
  assert.equal(await evaluate(`${aboutLink}.getAttribute('aria-current')`), 'page')
  assert.equal(await evaluate(`document.querySelectorAll('.pin-spacer').length`), label==='desktop'?2:1)
  await pinnedSequence('[data-about-hero-stage]',passages,3,`${label}-hero`)
  if (label==='desktop') await pinnedSequence('[data-about-services-stage]',services,3,`${label}-services`)
  else await naturalServices(label)
  await philosophy(label)
  await projects(label)
  await loadedImages()
  await footerReachable(label)
}
async function reducedMotion(label) {
  await command('Emulation.setEmulatedMedia', {features:[{name:'prefers-reduced-motion',value:'reduce'}]})
  await until(() => evaluate(`!document.querySelector('.pin-spacer') && getComputedStyle(document.querySelector('#smooth-wrapper')).position!=='fixed' && getComputedStyle(document.querySelector('#smooth-content')).transform==='none'`), `${label} reduced motion releases pins and fixed scrolling`)
  const targets=`document.querySelectorAll('[data-about-passage],[data-about-service],[data-about-reveal]')`
  const unreadable=await evaluate(`[...${targets}].map(element=>{
    const r=element.getBoundingClientRect();
    const style=getComputedStyle(element);
    const parentStyle=element.parentElement && getComputedStyle(element.parentElement);
    return {
      type:element.hasAttribute('data-about-passage')?'passage':element.hasAttribute('data-about-service')?'service':'philosophy',
      text:element.textContent.trim().slice(0,100),
      opacity:Number(style.opacity),visibility:style.visibility,
      bounds:{left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height},
      viewport:innerWidth,parentOpacity:parentStyle?.opacity,parentVisibility:parentStyle?.visibility,
      inlineStyle:element.getAttribute('style'),parentStyle:element.parentElement?.getAttribute('style'),
    };
  }).filter(element=>element.opacity!==1 || element.visibility!=='visible' || element.bounds.left < -1 || element.bounds.right > innerWidth+1)`)
  assert.deepEqual(unreadable,[],`${label}: every reduced-motion paragraph and service remains readable`)
  const before=await evaluate(transformState(targets))
  await naturalServices(`${label}-reduced`)
  await scrollTo(await evaluate(`document.querySelector('[data-about-philosophy]').getBoundingClientRect().top+scrollY-innerHeight*0.15`))
  await screenshot(`about-${label}-reduced.png`)
  assert.deepEqual(await evaluate(transformState(targets)),before,'reduced-motion text stays static while scrolling')
  assert.equal(await evaluate(noOverflow),true)
  await footerReachable(`${label} reduced motion`)
}
async function leaveAbout() {
  await evaluate(`document.querySelector('header nav a[href="/projects"]').click()`)
  await settled('/projects')
  await fontsAndCookies()
  assert.equal(await evaluate(`${about}===null && document.querySelectorAll('.pin-spacer').length===0`), true, 'leaving About removes its DOM and all home/About pins')
  await footerReachable('Projects after About')
  assert.equal(await evaluate(noOverflow),true)
  return evaluate('document.documentElement.scrollHeight')
}

try {
  await until(async () => (await fetch(origin)).ok,'preview server')
  let target
  await until(async () => {target=(await (await fetch('http://127.0.0.1:9292/json/list')).json()).find(item=>item.type==='page');return !!target},'browser target')
  socket=new WebSocket(target.webSocketDebuggerUrl)
  await new Promise((resolve,reject)=>{socket.addEventListener('open',resolve,{once:true});socket.addEventListener('error',reject,{once:true})})
  socket.addEventListener('message',({data})=>{
    const message=JSON.parse(data)
    if (message.method==='Runtime.exceptionThrown') exceptions.push(message.params.exceptionDetails)
    const call=calls.get(message.id)
    if (call) {calls.delete(message.id);message.error?call.reject(new Error(message.error.message)):call.resolve(message.result)}
  })
  await command('Runtime.enable')
  await command('Page.enable')
  await command('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false})
  await command('Page.navigate',{url:`${origin}/`})
  await settled('/')
  await fontsAndCookies()
  await evaluate(`
    window.__aboutMarker='same-document';
    window.__aboutTransitions=0;
    window.__hasNativeAbout=typeof document.startViewTransition==='function';
    if (window.__hasNativeAbout) {
      const start=document.startViewTransition.bind(document);
      document.startViewTransition=(update)=>{
        window.__aboutTransitions++;
        const transition=start(update);
        window.__activeAboutTransition=transition;
        transition.finished.then(()=>{if(window.__activeAboutTransition===transition)window.__activeAboutTransition=null},()=>{window.__activeAboutTransition=null});
        return transition;
      };
    }
  `)
  assert.equal(await evaluate(`${aboutLink}?.textContent.trim()`),'About')
  await press('Tab','Tab',9)
  await evaluate(`${aboutLink}.focus({preventScroll:true})`)
  assert.equal(await evaluate(`${aboutLink}.matches(':focus-visible')`),true)
  await press('Enter','Enter',13)
  await settled('/about')
  await fontsAndCookies()
  await until(() => evaluate(`document.activeElement.id==='main-content'`),'focus moves to the new page')
  assert.equal(await evaluate('window.__aboutMarker'),'same-document')
  assert.equal(await evaluate('!window.__hasNativeAbout || window.__aboutTransitions>0'),true,'About uses the existing SPA page transition')
  await layout('desktop')
  console.log('PASS desktop About: keyboard navigation and SPA transition; all hero passages and services; philosophy scroll/reverse; local images, project links and reachable footer')

  const projectsHeight=await leaveAbout()
  await evaluate('history.back()')
  await settled('/about')
  assert.equal(await evaluate(`${aboutLink}.getAttribute('aria-current')`),'page')
  await until(() => evaluate(`document.querySelectorAll('.pin-spacer').length===2`),'About pins restored after Back')
  assert.equal(await evaluate('window.__aboutMarker'),'same-document')
  await evaluate(`document.querySelector('header a[href="/"]').click()`)
  await settled('/')
  await until(() => evaluate(`document.querySelectorAll('.pin-spacer').length===2 && !!document.querySelector('[data-featured-stage]')?.closest('.pin-spacer') && !!document.querySelector('[data-specialties-stage]')?.closest('.pin-spacer')`),'home pins restored after leaving About')
  await evaluate(`${aboutLink}.click()`)
  await settled('/about')
  assert.ok(Math.abs(await leaveAbout()-projectsHeight)<=1,'repeated About visits do not leave stale pin spacing in the Projects scroll range')
  await evaluate(`${aboutLink}.click()`)
  await settled('/about')
  console.log('PASS Back and repeated SPA visits remove old pins, restore home/About correctly and preserve the Projects scroll range')

  await reducedMotion('desktop')
  await scrollTo(0)
  await command('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true})
  await command('Emulation.setTouchEmulationEnabled',{enabled:true})
  await delay(300)
  await mobileViewport('mobile reduced motion')
  await reducedMotion('mobile')
  await command('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'no-preference'}]})
  await until(() => evaluate(`document.querySelectorAll('.pin-spacer').length===1`),'mobile restores only the hero pin')
  await layout('mobile')
  await mobileViewport('mobile motion')
  assert.equal(await evaluate(`(() => {const r=${aboutLink}.getBoundingClientRect();return r.left>=0 && r.right<=innerWidth && r.width>0})()`),true,'the About navigation link fits on mobile')
  console.log('PASS mobile and live reduced motion: services stay in reading order, all text is visible, scrolling is released, and no horizontal overflow')

  await command('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]})
  await command('Page.navigate',{url:`${origin}/about`})
  await settled('/about')
  await fontsAndCookies()
  assert.equal(await evaluate(`!!${about} && document.querySelectorAll('main h1').length===1 && !document.querySelector('.pin-spacer')`),true,'the canonical About route works on direct entry')
  await mobileViewport('direct About entry')
  await command('Page.navigate',{url:`${origin}/about-us`})
  await settled('/about')
  await fontsAndCookies()
  assert.equal(await evaluate(`!!${about} && ${aboutLink}.getAttribute('aria-current')==='page' && !document.querySelector('.pin-spacer')`),true,'the reference URL alias resolves to canonical About')
  await mobileViewport('direct About alias')
  await screenshot('about-mobile-direct-alias.png')
  await footerReachable('direct About alias')
  assert.deepEqual(exceptions,[])
  console.log('PASS direct /about and /about-us alias; no stuck scrolling, leftover pins or uncaught browser exceptions')
} finally {
  if(socket?.readyState===WebSocket.OPEN){socket.send(JSON.stringify({id:++id,method:'Browser.close'}));socket.close()}
  browser.kill()
  server.kill()
}
