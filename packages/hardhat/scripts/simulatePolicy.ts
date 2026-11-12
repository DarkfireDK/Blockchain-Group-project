import { readFileSync } from "node:fs";
import { JsonRpcProvider } from "ethers";
import { simulatePolicy } from "./simulatePolicyCore.js";
async function main() {
  const raw = process.env.SIM_POLICY_ID || "";
  const outcome = process.env.SIM_OUTCOME;
  if (!/^[1-9]\d*$/.test(raw) || (outcome !== "claim" && outcome !== "refund")) throw Error("请使用项目根目录simulate-policy.cmd选择保单和场景。");
  const deployment = JSON.parse(readFileSync("deployments/default/Insurance.json", "utf8"));
  // Intentionally fixed loopback RPC; never use the user's wallet or Sepolia credentials.
  const provider = new JsonRpcProvider("http://127.0.0.1:8545", 31337, { cacheTimeout: -1 });
  try { console.log(JSON.stringify(await simulatePolicy(provider, deployment.address, BigInt(raw), outcome), null, 2)); }
  finally { provider.destroy(); }
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
