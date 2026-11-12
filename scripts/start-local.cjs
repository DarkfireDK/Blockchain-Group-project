// Windows double-click entry: local test assets only. Never imports/decrypts wallets.
const fs = require('node:fs');
const path = require('node:path');
const net = require('node:net');
const { spawn, spawnSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const runtime = path.join(root, '.local-run');
const yarn = path.join(root, '.yarn/releases/yarn-4.13.0.cjs');
const smoke = process.argv.includes('--smoke-test');
const frontendPort = smoke ? 3010 : 3000;
const url = `http://127.0.0.1:${frontendPort}`;
const check = process.argv.includes('--check');
const children = [];
const services = [];
let stopping = false, ownsLock = false;
const env = { ...process.env, NEXT_PUBLIC_TARGET_NETWORK: 'hardhat', NEXT_TELEMETRY_DISABLED: '1', MAINNET_FORKING_ENABLED: 'false', LAUNCHER_SMOKE_TEST: smoke ? '1' : '0' };
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
async function rpc(method) {
  const response = await fetch('http://127.0.0.1:8545', { method: 'POST', headers: {'content-type':'application/json'}, body: JSON.stringify({jsonrpc:'2.0', id:1, method, params:[]}), signal: AbortSignal.timeout(2500) });
  const data = await response.json(); if (data.error) throw Error(data.error.message); return data.result;
}
function listening(port) { return new Promise(resolve => { const socket = net.connect({port,host:'127.0.0.1'}); socket.setTimeout(1000); socket.once('connect',()=>{socket.destroy();resolve(true);}); for(const event of ['error','timeout']) socket.once(event,()=>{socket.destroy();resolve(false);}); }); }
function logFile(name) { return path.join(runtime, name + '.log'); }
function run(args, name) {
  const log = fs.openSync(logFile(name), 'w');
  const child = spawn(process.execPath, [yarn, ...args], {cwd:root, env, windowsHide:true, stdio:['ignore',log,log]});
  fs.closeSync(log);
  child.on('error', error=>{child.launchError=error;}); children.push(child); return child;
}
function ended(child) { return child.launchError || child.exitCode !== null || child.signalCode !== null; }
async function command(args, name) {
  const child = run(args,name);
  const code = await new Promise((resolve,reject)=>{child.once('error',reject);child.once('exit',resolve);});
  if(code!==0) throw Error(`${name}失败，请查看 ${logFile(name)}`);
}
async function ready(test, child, name, timeout) {
  const deadline = Date.now()+timeout;
  while(Date.now()<deadline) {
    if(child && ended(child)) throw Error(`${name}意外退出，请查看 ${logFile(name)}`);
    try { if(await test()) return; } catch {}
    await sleep(1000);
  }
  throw Error(`${name}启动超时，请查看 ${logFile(name)}`);
}
function openBrowser() {
  if(process.platform==='win32') { const child=spawn('rundll32.exe',['url.dll,FileProtocolHandler',url],{windowsHide:true,stdio:'ignore'}); child.on('error',()=>console.log(`请手动打开 ${url}`)); child.unref(); }
}
function cleanup() {
  if(stopping) return; stopping=true;
  for(const child of children.reverse()) {
    if(!child.pid || ended(child)) continue;
    if(process.platform==='win32') spawnSync('taskkill',['/PID',String(child.pid),'/T','/F'],{windowsHide:true,stdio:'ignore',timeout:10000});
    else child.kill('SIGTERM');
  }
  if(ownsLock) { try{fs.unlinkSync(path.join(runtime,'launcher.json'));}catch{} }
}
process.on('SIGINT',()=>{cleanup();process.exit(0);});
process.on('SIGTERM',()=>{cleanup();process.exit(0);});
process.on('exit',cleanup);
async function main() {
  process.chdir(root);
  const [major,minor] = process.versions.node.split('.').map(Number);
  if(major<22 || (major===22 && minor<14)) throw Error('请安装Node.js 22.14或更高版本。');
  if(!fs.existsSync(yarn)) throw Error('缺少仓库内置Yarn，请重新下载完整项目。');
  if(check) { console.log(JSON.stringify({node:process.versions.node,chainPortInUse:await listening(8545),frontendPortInUse:await listening(3000),dependenciesInstalled:fs.existsSync(path.join(root,'packages/hardhat/node_modules/hardhat'))})); return; }
  fs.mkdirSync(runtime,{recursive:true});
  const lock=path.join(runtime,'launcher.json');
  if(fs.existsSync(lock)) {
    let previous; try{previous=JSON.parse(fs.readFileSync(lock,'utf8'));}catch{throw Error('启动记录损坏，请检查.local-run/launcher.json。');}
    let alive=false;try{process.kill(previous.pid,0);alive=true;}catch{}
    if(alive) { console.log(`项目启动程序已在运行。请使用原窗口；页面地址：${url}`); if(!smoke)openBrowser();return; }
    fs.unlinkSync(lock);
  }
  fs.writeFileSync(lock,JSON.stringify({pid:process.pid,root}),{flag:'wx'});ownsLock=true;
  console.log('AERIS 保险项目 · 本地测试模式\n日志目录：'+runtime);
  if(await listening(frontendPort)) throw Error(`${frontendPort}端口已被占用。请关闭已有前端窗口后重试；不会自动结束其他程序。`);
  if(!fs.existsSync(path.join(root,'packages/hardhat/node_modules/hardhat')) || !fs.existsSync(path.join(root,'packages/nextjs/node_modules/next'))) {
    console.log('首次运行，正在安装锁定依赖，可能需要几分钟……'); await command(['install','--immutable'],'install');
  }
  if(await listening(8545)) {
    if(await rpc('eth_chainId')!=='0x7a69') throw Error('8545端口不是本地31337测试链。');
    const metadata=await rpc('hardhat_metadata');if(metadata?.chainId!==31337 || !/^(HardhatNetwork|edr)\//.test(metadata.clientVersion || '') || metadata.forkedNetwork) throw Error('8545端口不是可识别的独立Hardhat测试链。');
    console.log('复用已有本地Hardhat链，结束时会保留它。');
  } else {
    console.log('正在启动本地测试链……');const chain=run(['chain'],'chain');services.push(chain);
    await ready(async()=>await rpc('eth_chainId')==='0x7a69',chain,'chain',60000);
  }
  console.log('正在编译并部署本地测试合约……');await command(['deploy','--network','default'],'deploy');
  if(await listening(frontendPort)) throw Error(`${frontendPort}端口刚被其他程序占用，请关闭它后重试。`);
  console.log('正在启动前端……');const frontend=run(['workspace','@se-2/nextjs','exec','next','dev','--hostname','127.0.0.1','--port',String(frontendPort)],'frontend');services.push(frontend);
  await ready(async()=>{const r=await fetch(url,{signal:AbortSignal.timeout(5000)});return r.ok && (await r.text()).includes('AERIS');},frontend,'frontend',180000);
  console.log(`\n启动成功：${url}\n仅使用本地31337测试链。请保留此窗口，按Ctrl+C停止本次启动的服务。`);
  if(smoke) {console.log('SMOKE TEST PASSED');cleanup();return;}
  openBrowser();
  while(!stopping) {await sleep(2000);if(services.some(ended))throw Error('服务意外停止，请查看.local-run日志。');}
}
main().catch(error=>{console.error('\n启动失败：'+error.message);cleanup();process.exitCode=1;});
