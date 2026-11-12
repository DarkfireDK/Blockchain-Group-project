const readline = require('node:readline');
const path = require('node:path');
const fs = require('node:fs');
const { spawn } = require('node:child_process');
const root = path.resolve(__dirname, '..');

function parsePolicyId(value) {
  const text = value.trim();
  if (!/^[1-9]\d*$/.test(text)) throw Error('保单编号应为大于0的整数，例如1；不要输入#。');
  return text;
}
function parseOutcome(value) {
  if (value.trim() === '1') return 'claim';
  if (value.trim() === '2') return 'refund';
  throw Error('请输入1或2选择场景。');
}
async function main() {
  const [major, minor] = process.versions.node.split('.').map(Number);
  if (major < 22 || (major === 22 && minor < 14)) throw Error('请安装Node.js 22.14或更新版本。');
  console.log('\n航班保险本地模拟器\n请先保持start-project.cmd运行，并在页面创建有效保单。');
  console.log('注意：模拟会推进整条本地链的时间，影响其他保单；同一张保单只能结算一次。\n');
  const rl = readline.createInterface({input: process.stdin, output: process.stdout, terminal: Boolean(process.stdin.isTTY)});
  const lines = rl[Symbol.asyncIterator]();
  const ask = async (prompt, parse) => {
    for (;;) {
      process.stdout.write(prompt);
      const next = await lines.next();
      if (next.done) throw Error('输入已结束，未执行模拟。请双击simulate-policy.cmd重新选择。');
      try { return parse(next.value); } catch (error) { console.log(error.message); }
    }
  };
  let id, outcome;
  try {
    id = await ask('请输入保单编号（例如1）：', parsePolicyId);
    console.log('\n1. 模拟延误：资金池向当前持有人支付保额\n2. 模拟未延误：到期并经过宽限期后退还可退保费');
    outcome = await ask('请选择1或2，然后按回车：', parseOutcome);
  } finally { rl.close(); }
  if (process.argv.includes('--dry-run')) {
    console.log(`菜单检查通过：保单${id}，场景${outcome}。未发送交易、未推进链时间。`);
    return;
  }
  const yarn = path.join(root, '.yarn/releases/yarn-4.13.0.cjs');
  if (!fs.existsSync(yarn)) throw Error('项目文件不完整，缺少内置Yarn。');
  if (!fs.existsSync(path.join(root, 'packages/hardhat/node_modules/tsx'))) throw Error('请先运行start-project.cmd安装项目依赖。');
  console.log(`\n正在模拟保单${id}：${outcome === 'claim' ? '延误赔付' : '未延误退款'}……`);
  const result = await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [yarn, 'workspace', '@se-2/hardhat', 'exec', 'tsx', 'scripts/simulatePolicy.ts'], {
      cwd: root, shell: false, stdio: 'inherit', windowsHide: true,
      env: {...process.env, SIM_POLICY_ID: id, SIM_OUTCOME: outcome},
    });
    child.once('error', reject);
    child.once('close', (code, signal) => resolve({code, signal}));
  });
  if (result.code !== 0) throw Error('模拟未完成，请查看上方错误信息；先确认本地项目正在运行、保单尚未结算。');
  console.log('\n模拟完成。刷新浏览器，核对USDC余额和保单状态。');
}
module.exports = { parsePolicyId, parseOutcome };
if (require.main === module) main().catch(error => { console.error('\n模拟失败：'+error.message); process.exitCode = 1; });
