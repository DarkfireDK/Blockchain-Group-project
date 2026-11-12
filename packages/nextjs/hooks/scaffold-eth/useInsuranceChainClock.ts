"use client";

import { useBlock } from "wagmi";
import { useTargetNetwork } from "~~/hooks/scaffold-eth";

// Local Hardhat mines on demand. Explicitly poll latest instead of relying only on block subscriptions.
export const useInsuranceChainClock = () => {
  const { targetNetwork } = useTargetNetwork();
  return useBlock({
    chainId: targetNetwork.id,
    scopeKey: "insurance-chain-clock",
    query: { refetchInterval: 2000, refetchOnWindowFocus: "always", staleTime: 0 },
  });
};
