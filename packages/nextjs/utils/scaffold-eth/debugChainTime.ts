export type DebugRpc = (method: string, params: unknown[]) => Promise<unknown>;
export async function setDebugChainTime(timestamp: bigint, request: DebugRpc): Promise<bigint> {
  if (timestamp <= 0n || timestamp > 8640000000000n) throw Error("请输入有效的目标日期。");
  if (await request("eth_chainId", []) !== "0x7a69") throw Error("Debug仅支持本地Hardhat链31337。");
  const metadata = await request("hardhat_metadata", []) as {chainId?:number;clientVersion?:string;forkedNetwork?:unknown};
  if (metadata.chainId !== 31337 || !/^(HardhatNetwork|edr)\//.test(metadata.clientVersion ?? "") || metadata.forkedNetwork) throw Error("Debug仅支持独立的本地Hardhat链。");
  const block = await request("eth_getBlockByNumber", ["latest", false]) as {timestamp?:string};
  if (!block?.timestamp) throw Error("无法读取链上时间。");
  if (timestamp <= BigInt(block.timestamp)) throw Error("目标时间必须晚于当前链上时间；已有区块不能调回过去。");
  await request("evm_setNextBlockTimestamp", [Number(timestamp)]);
  await request("evm_mine", []);
  const updated = await request("eth_getBlockByNumber", ["latest", false]) as {timestamp?:string};
  if (!updated?.timestamp || BigInt(updated.timestamp) !== timestamp) throw Error("请重新读取区块以确认时间设置结果。");
  return BigInt(updated.timestamp);
}
