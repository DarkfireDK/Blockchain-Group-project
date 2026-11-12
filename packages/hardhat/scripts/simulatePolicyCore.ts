import { Contract, type Provider, type Signer, formatUnits } from "ethers";

export type LocalSimulationProvider = Provider & {
  send(method: string, params: unknown[]): Promise<any>;
  getSigner(index: number): Promise<Signer>;
};
export async function simulatePolicy(provider: LocalSimulationProvider, insuranceAddress: string, id: bigint, outcome: "claim" | "refund") {
  if ((await provider.getNetwork()).chainId !== 31337n) throw Error("仅允许Hardhat本地链31337，不能操作Sepolia或主网。");
  const metadata = await provider.send("hardhat_metadata", []);
  if (metadata.chainId !== 31337 || metadata.forkedNetwork) throw Error("不允许分叉网络或非本地测试网络。");
  if (id < 1n || !["claim", "refund"].includes(outcome)) throw Error("无效保单编号或模拟场景");
  if (await provider.getCode(insuranceAddress) === "0x") throw Error("找不到保险合约，请先启动项目并部署。");
  const signer = await provider.getSigner(0);
  const insurance = new Contract(insuranceAddress, ["function policyNFT() view returns(address)", "function usdc() view returns(address)", "function policyOracle(uint256) view returns(address)", "function policyMinDelay(uint256) view returns(uint32)", "function REPORT_GRACE_PERIOD() view returns(uint256)", "function expirePolicy(uint256)"], signer);
  const nft = new Contract(await insurance.policyNFT(), ["function ownerOf(uint256) view returns(address)", "function getPolicy(uint256) view returns(tuple(string flightNumber,uint64 departureDate,uint64 coverageStart,uint64 coverageEnd,uint256 coverageAmount,uint256 premium,uint256 riskFee,uint256 refundableAmount,uint8 status))"], provider);
  const policy = await nft.getPolicy(id);
  if (policy.status !== 1n) throw Error("该保单不存在或已经结算，不能重复模拟。");
  const beneficiary = await nft.ownerOf(id);
  const token = new Contract(await insurance.usdc(), ["function balanceOf(address) view returns(uint256)"], provider);
  const before = await token.balanceOf(beneficiary);
  const block = await provider.getBlock("latest");
  if (!block) throw Error("无法读取本地区块");
  const graceEnd = policy.coverageEnd + await insurance.REPORT_GRACE_PERIOD();
  let tx;
  if (outcome === "claim") {
    const oracle = new Contract(await insurance.policyOracle(id), ["function REPORTER_ROLE() view returns(bytes32)", "function hasRole(bytes32,address) view returns(bool)", "function reportDelay(uint256,uint32)"], signer);
    if (!await oracle.hasRole(await oracle.REPORTER_ROLE(), await signer.getAddress())) throw Error("本地部署账户没有该保单Oracle的报告权限。");
    if (BigInt(block.timestamp) >= graceEnd) throw Error("本地链已超过该保单报告窗口，请创建新保单再测试延误。");
    if (BigInt(block.timestamp) < policy.departureDate) await provider.send("evm_setNextBlockTimestamp", [Number(policy.departureDate)]);
    tx = await oracle.reportDelay(id, await insurance.policyMinDelay(id));
  } else {
    if (BigInt(block.timestamp) <= graceEnd) await provider.send("evm_setNextBlockTimestamp", [Number(graceEnd + 1n)]);
    tx = await insurance.expirePolicy(id);
  }
  const receipt = await tx.wait();
  if (receipt?.status !== 1) throw Error("模拟交易失败");
  const after = await token.balanceOf(beneficiary);
  const final = await nft.getPolicy(id);
  const expectedAmount = outcome === "claim" ? policy.coverageAmount : policy.refundableAmount;
  const expectedStatus = outcome === "claim" ? 2n : 3n;
  if (after - before !== expectedAmount || final.status !== expectedStatus) throw Error("实际到账或保单状态与预期不一致，请检查交易记录。");
  return { policyId: String(id), outcome, beneficiary, receivedUSDC: formatUnits(after - before, 6), finalStatus: String(final.status), transaction: tx.hash };
}
