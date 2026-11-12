"use client";
import { useInsuranceChainClock } from "~~/hooks/scaffold-eth/useInsuranceChainClock";
import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useTargetNetwork } from "~~/hooks/scaffold-eth";
import { setDebugChainTime } from "~~/utils/scaffold-eth/debugChainTime";
import { ConsoleButton, inputClassName, toDateTimeLocal, toUnixTimestamp } from "./shared";

async function localRpc(method: string, params: unknown[]) {
  const response = await fetch("http://127.0.0.1:8545", {method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({jsonrpc:"2.0",id:1,method,params}),signal:AbortSignal.timeout(5000)});
  if (!response.ok) throw Error("无法连接本地测试链，请先启动项目。");
  const result = await response.json();
  if (result.error) throw Error(result.error.message || "本地RPC操作失败");
  return result.result;
}
export const DebugChainTime = () => {
  const {targetNetwork} = useTargetNetwork();
  const {data:block, refetch} = useInsuranceChainClock();
  const cache = useQueryClient();
  const dialog = useRef<HTMLDialogElement>(null);
  const [localPage,setLocalPage] = useState(false);
  const [target,setTarget] = useState("");
  const [busy,setBusy] = useState(false);
  const [message,setMessage] = useState("");
  useEffect(()=>setLocalPage(["localhost","127.0.0.1","[::1]"].includes(window.location.hostname)),[]);
  if (targetNetwork.id !== 31337 || !localPage) return null;
  const preset = async (seconds: number) => {
    try {
      const latest = await localRpc("eth_getBlockByNumber",["latest",false]) as {timestamp:string};
      const base=Number(BigInt(latest.timestamp));
      setTarget(toDateTimeLocal(new Date((base+seconds)*1000)));
      await refetch();
    } catch { setMessage("无法读取本地链，请确认启动程序仍在运行。"); }
  };
  const open = () => { setMessage("");dialog.current?.showModal();void preset(3600); };
  const apply = async () => {
    const timestamp=toUnixTimestamp(target);
    if (timestamp === undefined) {setMessage("请选择目标日期与时间。");return;}
    setBusy(true);setMessage("");
    try {
      await setDebugChainTime(timestamp,localRpc);
      await refetch();await cache.invalidateQueries();
      setMessage("设置成功，已生成新区块。保单状态不会自动结算，请再执行上报或退款交易。");
    } catch(error) {setMessage(error instanceof Error ? error.message : "时间设置失败，请检查本地链连接。");}
    finally {setBusy(false);}
  };
  return <>
    <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-[#839095]">
      <ConsoleButton variant="ghost" onClick={open}>设置链上时间（Debug）</ConsoleButton>
      <span>仅本地调试 · 当前链上时间：{block ? new Date(Number(block.timestamp)*1000).toLocaleString("zh-CN",{hour12:false}) : "读取中"}</span>
    </div>
    <dialog ref={dialog} className="w-[calc(100%_-_32px)] max-w-[480px] rounded-xl border border-white/15 bg-[#0d1114] p-6 text-[#edf3f1] shadow-xl backdrop:bg-black/70" onCancel={event=>{if(busy)event.preventDefault();}}>
      <h2 className="m-0 text-lg font-semibold">设置链上时间 <span className="text-sm text-[#f4c66a]">Debug</span></h2>
      <p className="mt-3 text-sm leading-6 text-[#aeb9b7]">仅用于本地Hardhat测试。会推进整条链的时间，影响所有保单；只能向前设置，不能回到过去。不会重置余额或保单。</p>
      <label className="mt-4 block text-sm">目标时间（浏览器本地时区）<input aria-label="Debug目标链上时间" type="datetime-local" step="1" className={`${inputClassName} mt-2`} value={target} onChange={event=>setTarget(event.target.value)} disabled={busy}/></label>
      <div className="mt-3 flex gap-2"><ConsoleButton variant="ghost" onClick={()=>void preset(3600)} disabled={busy}>当前链时间 +1小时</ConsoleButton><ConsoleButton variant="ghost" onClick={()=>void preset(86400)} disabled={busy}>+1天</ConsoleButton></div>
      {message && <p role="status" className="mt-4 text-sm leading-6 text-[#f4c66a]">{message}</p>}
      <div className="mt-5 flex justify-end gap-2"><ConsoleButton variant="ghost" onClick={()=>dialog.current?.close()} disabled={busy}>关闭</ConsoleButton><ConsoleButton onClick={()=>void apply()} busy={busy} disabled={!target}>设置并生成区块</ConsoleButton></div>
    </dialog>
  </>;
};
