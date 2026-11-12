"use client";

import { useState } from "react";
import { FlightStatusPanel } from "./FlightStatusPanel";
import {
  ConsoleButton,
  ConsolePanel,
  InlineNotice,
  SectionHeading,
  StatusChip,
  inputClassName,
  labelClassName,
  shortAddress,
} from "./shared";
import { isAddress } from "viem";
import { useAccount } from "wagmi";
import { AdjustmentsHorizontalIcon, CommandLineIcon, LockClosedIcon } from "@heroicons/react/24/outline";
import { useScaffoldContract, useScaffoldReadContract, useScaffoldWriteContract } from "~~/hooks/scaffold-eth";
import { notification } from "~~/utils/scaffold-eth";

export const OperationsPanel = () => {
  const { address } = useAccount();
  const [oracleAddress, setOracleAddress] = useState("");
  const [newMinDelay, setNewMinDelay] = useState("");

  const insuranceWrite = useScaffoldWriteContract({ contractName: "Insurance" });

  const { data: adminRole } = useScaffoldReadContract({
    contractName: "Insurance",
    functionName: "DEFAULT_ADMIN_ROLE",
  });
  const { data: isAdmin } = useScaffoldReadContract({
    contractName: "Insurance",
    functionName: "hasRole",
    args: [adminRole, address],
    query: { enabled: Boolean(address && adminRole) },
  });
  const { data: minDelay } = useScaffoldReadContract({
    contractName: "Insurance",
    functionName: "minDelayMinutes",
  });
  const { data: currentOracle } = useScaffoldReadContract({
    contractName: "Insurance",
    functionName: "oracle",
  });

  const handleSetOracle = async () => {
    if (!isAddress(oracleAddress)) {
      notification.error("请输入有效的预言机地址");
      return;
    }
    try {
      await insuranceWrite.writeContractAsync({ functionName: "setOracle", args: [oracleAddress] });
      notification.success("预言机地址已更新");
      setOracleAddress("");
    } catch {
      // Error feedback is handled by the scaffold hook.
    }
  };

  const handleSetMinDelay = async () => {
    if (!newMinDelay) return;
    try {
      await insuranceWrite.writeContractAsync({
        functionName: "setMinDelayMinutes",
        args: [Number(newMinDelay)],
      });
      notification.success("延误门槛已更新");
      setNewMinDelay("");
    } catch {
      // Error feedback is handled by the scaffold hook.
    }
  };

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1.1fr)_minmax(360px,0.9fr)]">
      <div className="space-y-5">
        <FlightStatusPanel />
      </div>

      <div className="space-y-5">
        <ConsolePanel className="p-5 sm:p-6">
          <SectionHeading
            eyebrow="协议管理"
            title="风险参数"
            description="仅管理员可调整预言机上报权限与理赔门槛。"
            action={<StatusChip label={isAdmin ? "管理员" : "已锁定"} tone={isAdmin ? "success" : "neutral"} />}
          />
          <div className="mt-5 space-y-5">
            <label className="block">
              <span className={labelClassName}>延误门槛</span>
              <div className="flex gap-2">
                <input
                  className={`${inputClassName} font-mono`}
                  placeholder={minDelay?.toString() ?? "60"}
                  inputMode="numeric"
                  value={newMinDelay}
                  onChange={event => setNewMinDelay(event.target.value.replace(/\D/g, ""))}
                  disabled={!isAdmin}
                />
                <ConsoleButton
                  variant="secondary"
                  onClick={handleSetMinDelay}
                  busy={insuranceWrite.isMining}
                  disabled={!isAdmin || !newMinDelay}
                  icon={<AdjustmentsHorizontalIcon className="h-4 w-4" />}
                >
                  保存
                </ConsoleButton>
              </div>
            </label>
            <label className="block">
              <span className={labelClassName}>预言机地址</span>
              <input
                className={`${inputClassName} font-mono text-xs`}
                placeholder={currentOracle ?? "0x..."}
                value={oracleAddress}
                onChange={event => setOracleAddress(event.target.value)}
                disabled={!isAdmin}
              />
            </label>
            <ConsoleButton
              className="w-full"
              variant="secondary"
              onClick={handleSetOracle}
              busy={insuranceWrite.isMining}
              disabled={!isAdmin || !oracleAddress}
              icon={
                isAdmin ? <AdjustmentsHorizontalIcon className="h-4 w-4" /> : <LockClosedIcon className="h-4 w-4" />
              }
            >
              更新预言机
            </ConsoleButton>
          </div>
          {!isAdmin && (
            <div className="mt-4">
              <InlineNotice>请连接拥有 `DEFAULT_ADMIN_ROLE` 的钱包来修改协议参数。</InlineNotice>
            </div>
          )}
        </ConsolePanel>

        <ConsolePanel className="p-5 sm:p-6">
          <SectionHeading eyebrow="网络" title="已部署合约" />
          <div className="mt-4">
            <ContractReference contractName="Insurance" />
            <ContractReference contractName="InsurancePool" />
            <ContractReference contractName="PolicyNFT" />
            <ContractReference contractName="PolicyMarket" />
            <ContractReference contractName="Oracle" />
            <ContractReference contractName="MockUSDC" />
          </div>
        </ConsolePanel>
      </div>
    </div>
  );
};

const ContractReference = ({
  contractName,
}: {
  contractName: "Insurance" | "InsurancePool" | "PolicyNFT" | "PolicyMarket" | "Oracle" | "MockUSDC";
}) => {
  const { data: contract } = useScaffoldContract({ contractName });

  return (
    <div className="flex items-center justify-between gap-4 border-b border-white/[0.06] py-3 last:border-0">
      <span className="flex items-center gap-2 text-[11px] text-[#8a979a]">
        <CommandLineIcon className="h-3.5 w-3.5 text-[#647276]" /> {contractName}
      </span>
      <span className="font-mono text-[10px] text-[#b7c1bf]" title={contract?.address}>
        {shortAddress(contract?.address)}
      </span>
    </div>
  );
};
