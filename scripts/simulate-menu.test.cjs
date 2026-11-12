const {test} = require('node:test');
const assert = require('node:assert/strict');
const {spawnSync} = require('node:child_process');
const path = require('node:path');
const {parsePolicyId, parseOutcome} = require('./simulate-policy.cjs');
test('rejects invalid identifiers and menu choices',()=>{
  for(const id of ['', '0', '-1', '#1', '1 & exit']) assert.throws(()=>parsePolicyId(id));
  assert.equal(parsePolicyId(' 123 '),'123');
  assert.throws(()=>parseOutcome('3'));
});
for(const [choice,outcome] of [['1','claim'],['2','refund']]) test('interactive menu selects '+outcome+' without transactions',()=>{
  const r=spawnSync(process.execPath,[path.join(__dirname,'simulate-policy.cjs'),'--dry-run'],{input:`1\n${choice}\n`,encoding:'utf8',timeout:5000});
  assert.equal(r.status,0,r.stderr);assert.match(r.stdout,new RegExp('场景'+outcome));assert.match(r.stdout,/未发送交易/);
});
test('invalid input can be corrected without closing the menu',()=>{
  const r=spawnSync(process.execPath,[path.join(__dirname,'simulate-policy.cjs'),'--dry-run'],{input:'bad\n2\nwrong\n2\n',encoding:'utf8',timeout:5000});
  assert.equal(r.status,0,r.stderr);assert.match(r.stdout,/保单2，场景refund/);
});
test('end of input fails without running a simulation',()=>{
  const r=spawnSync(process.execPath,[path.join(__dirname,'simulate-policy.cjs'),'--dry-run'],{input:'',encoding:'utf8',timeout:5000});
  assert.equal(r.status,1);assert.match(r.stderr,/未执行模拟/);
});
test('Windows double-click wrapper reaches the Chinese menu', {skip:process.platform!=='win32'},()=>{
  const r=spawnSync('cmd.exe',['/d','/c','simulate-policy.cmd --dry-run'],{cwd:path.resolve(__dirname,'..'),input:'1\r\n1\r\n\r\n',encoding:'utf8',timeout:5000});
  assert.equal(r.status,0,r.stderr);assert.match(r.stdout,/场景claim/);assert.doesNotMatch(r.stderr,/not recognized|不是内部或外部命令/);
});
