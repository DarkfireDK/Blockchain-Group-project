import { network } from "hardhat";
import { expect } from "chai";

describe("Flight delay insurance", function () {
  async function fixture() {
    const { ethers } = await network.create();
    const [admin, lp, traveler, buyer, outsider] = await ethers.getSigners();
    const usdc = await ethers.deployContract("MockUSDC");
    const nft = await ethers.deployContract("PolicyNFT", [admin.address]);
    const pool = await ethers.deployContract("InsurancePool", [usdc.target, admin.address]);
    const insurance = await ethers.deployContract("Insurance", [pool.target, nft.target, usdc.target, admin.address, 60]);
    const oracle = await ethers.deployContract("Oracle", [insurance.target, admin.address]);
    const market = await ethers.deployContract("PolicyMarket", [usdc.target, nft.target, admin.address, admin.address, 200]);
    const role = ethers.id("INSURER_ROLE");
    await nft.grantRole(role, insurance.target);
    await pool.grantRole(role, insurance.target);
    await insurance.setOracle(oracle.target);
    await oracle.grantRole(ethers.id("REPORTER_ROLE"), admin.address);
    const unit = 10n ** 6n;
    await usdc.mint(lp.address, 10000n * unit);
    await usdc.mint(traveler.address, 100n * unit);
    await usdc.mint(buyer.address, 100n * unit);
    await usdc.connect(lp).approve(pool.target, 10000n * unit);
    await pool.connect(lp).deposit(10000n * unit, lp.address);
    await usdc.connect(traveler).approve(pool.target, 100n * unit);
    const now = (await ethers.provider.getBlock("latest"))!.timestamp;
    const terms = ["CX528", now + 3600, now + 3600, now + 7200, 1000n * unit, 20n * unit, 10n * unit] as const;
    const purchase = () => insurance.connect(traveler).purchasePolicy(...terms);
    const report = async (delay = 60) => {
      if ((await ethers.provider.getBlock("latest"))!.timestamp < now + 3600) await ethers.provider.send("evm_setNextBlockTimestamp", [now + 3600]);
      return oracle.reportDelay(1, delay);
    };
    return { ethers, admin, lp, traveler, buyer, outsider, usdc, nft, pool, insurance, oracle, market, unit, now, purchase, report, terms };
  }

  it("mints policy and reserves coverage and refundable premium", async function () {
    const { purchase, nft, pool, traveler, unit } = await fixture();
    await purchase();
    expect(await nft.ownerOf(1)).to.equal(traveler.address);
    expect(await pool.totalLockedCoverage()).to.equal(1000n * unit);
    expect(await pool.totalRefundReserve()).to.equal(10n * unit);
  });
  it("pays qualifying claim once and burns policy", async function () {
    const { purchase, report, oracle, nft, pool, usdc, traveler, unit } = await fixture();
    await purchase();
    const before = await usdc.balanceOf(traveler.address);
    await (await report()).wait();
    expect(await usdc.balanceOf(traveler.address)).to.equal(before + 1000n * unit);
    expect((await nft.getPolicy(1)).status).to.equal(2n);
    expect(await pool.totalLockedCoverage()).to.equal(0n);
    await expect(oracle.reportDelay(1, 60)).to.be.revertedWithCustomError(oracle, "AlreadyReported");
  });
  it("rejects unauthorized reports and direct claim callbacks", async function () {
    const { purchase, oracle, insurance, outsider } = await fixture();
    await purchase();
    await expect(oracle.connect(outsider).reportDelay(1, 60)).to.be.revertedWithCustomError(oracle, "AccessControlUnauthorizedAccount");
    await expect(insurance.connect(outsider).onDelayReported(1, 60)).to.be.revertedWithCustomError(insurance, "UnauthorizedOracle");
  });
  it("rolls back below-threshold reports and allows later qualifying report", async function () {
    const { purchase, report, oracle, insurance } = await fixture();
    await purchase();
    await expect(report(59)).to.be.revertedWithCustomError(insurance, "DelayBelowThreshold");
    expect(await oracle.reported(1)).to.equal(false);
    await report();
  });
  it("refunds at expiry once and rejects early expiry", async function () {
    const { purchase, ethers, insurance, usdc, traveler, nft, now, unit } = await fixture();
    await purchase();
    await expect(insurance.expirePolicy(1)).to.be.revertedWithCustomError(insurance, "CoveragePeriodNotEnded");
    await ethers.provider.send("evm_setNextBlockTimestamp", [now + 7200 + 86401]);
    const before = await usdc.balanceOf(traveler.address);
    await (await insurance.expirePolicy(1)).wait();
    expect(await usdc.balanceOf(traveler.address)).to.equal(before + 10n * unit);
    expect((await nft.getPolicy(1)).status).to.equal(3n);
    await expect(insurance.expirePolicy(1)).to.be.revertedWithCustomError(insurance, "PolicyNotActive");
  });
  it("does not allow LP withdrawal to consume reserved funds", async function () {
    const { purchase, pool, lp, usdc, unit } = await fixture();
    await purchase();
    await expect(pool.connect(lp).withdraw(await pool.liquidity(lp.address), lp.address)).to.be.revertedWithCustomError(pool, "InsufficientLiquidity");
    await pool.connect(lp).withdraw(8000n * unit, lp.address);
    expect(await usdc.balanceOf(pool.target)).to.equal(2020n * unit);
  });
  it("requires premium authorization atomically", async function () {
    const { purchase, usdc, traveler, pool, insurance } = await fixture();
    await usdc.connect(traveler).approve(pool.target, 0);
    await expect(purchase()).to.be.revertedWithCustomError(usdc, "ERC20InsufficientAllowance");
    expect(await insurance.nextPolicyId()).to.equal(1n);
    expect(await pool.totalLockedCoverage()).to.equal(0n);
  });
  it("transfers policy on sale, charges fee and pays the new owner", async function () {
    const { purchase, report, nft, market, traveler, buyer, usdc, unit, admin } = await fixture();
    await purchase();
    await nft.connect(traveler).approve(market.target, 1);
    await market.connect(traveler).list(1, 50n * unit);
    await usdc.connect(buyer).approve(market.target, 50n * unit);
    const accounts = [buyer, traveler, admin];
    const before = await Promise.all(accounts.map(a => usdc.balanceOf(a.address)));
    await (await market.connect(buyer).buy(1, 50n * unit)).wait();
    const after = await Promise.all(accounts.map(a => usdc.balanceOf(a.address)));
    expect(after.map((value, i) => value - before[i])).to.deep.equal([-50n * unit, 49n * unit, unit]);
    expect(await nft.ownerOf(1)).to.equal(buyer.address);
    const buyerBefore = await usdc.balanceOf(buyer.address);
    await (await report()).wait();
    expect(await usdc.balanceOf(buyer.address)).to.equal(buyerBefore + 1000n * unit);
  });
  it("rejects a cancelled listing", async function () {
    const { purchase, market, traveler, buyer, unit } = await fixture();
    await purchase();
    await market.connect(traveler).list(1, 1);
    await market.connect(traveler).cancelListing(1);
    await expect(market.connect(buyer).buy(1, 50n * unit)).to.be.revertedWithCustomError(market, "InvalidListing");
  });
  it("enforces tariff, amount bounds and consistent flight dates", async function () {
    const { insurance, traveler, terms, unit } = await fixture();
    expect(await insurance.quotePolicy(1000n * unit)).to.deep.equal([20n * unit, 10n * unit]);
    await expect(insurance.quotePolicy(1)).to.be.revertedWithCustomError(insurance, "InvalidPolicyTerms");
    await expect(insurance.connect(traveler).purchasePolicy(terms[0], terms[1], terms[2], terms[3], terms[4], 1, 0)).to.be.revertedWithCustomError(insurance, "InvalidPolicyTerms");
    await expect(insurance.connect(traveler).purchasePolicy("CX528", terms[2]-1, terms[2], terms[3], terms[4], terms[5], terms[6])).to.be.revertedWithCustomError(insurance, "InvalidPolicyTerms");
  });
  it("blocks reports before departure and after grace window", async function () {
    const { purchase, oracle, insurance, ethers, now } = await fixture();
    await purchase();
    await expect(oracle.reportDelay(1, 60)).to.be.revertedWithCustomError(insurance, "OutsideReportWindow");
    await ethers.provider.send("evm_setNextBlockTimestamp", [now+7200+86401]);
    await expect(oracle.reportDelay(1, 60)).to.be.revertedWithCustomError(insurance, "OutsideReportWindow");
    expect(await oracle.reported(1)).to.equal(false);
  });
  it("allows a report at the last grace second and forbids competing expiry", async function () {
    const { purchase, oracle, insurance, ethers, now } = await fixture();
    await purchase();
    await ethers.provider.send("evm_setNextBlockTimestamp", [now+7200+86400]);
    await expect(insurance.expirePolicy(1)).to.be.revertedWithCustomError(insurance, "CoveragePeriodNotEnded");
    // Rewind via snapshot for the exact report boundary, not the next block.
    const f = await fixture(); await f.purchase();
    await f.ethers.provider.send("evm_setNextBlockTimestamp", [f.now+7200+86400]);
    await f.oracle.reportDelay(1,60);
    expect((await f.nft.getPolicy(1)).status).to.equal(2n);
  });
  it("snapshots oracle and threshold for existing policies", async function () {
    const { purchase, insurance, ethers, admin, oracle, report, nft } = await fixture();
    await purchase();
    const replacement=await ethers.deployContract("Oracle",[insurance.target,admin.address]);
    await insurance.setOracle(replacement.target);
    await insurance.setMinDelayMinutes(120);
    expect(await insurance.policyOracle(1)).to.equal(await oracle.getAddress());
    expect(await insurance.policyMinDelay(1)).to.equal(60n);
    await report(60);
    expect((await nft.getPolicy(1)).status).to.equal(2n);
  });
  it("pauses new policies while preserving refunds", async function () {
    const { purchase, insurance, ethers, now, outsider, nft } = await fixture();
    await purchase();
    await expect(insurance.connect(outsider).pause()).to.be.revertedWithCustomError(insurance,"AccessControlUnauthorizedAccount");
    await insurance.pause();
    await expect(purchase()).to.be.revertedWithCustomError(insurance,"EnforcedPause");
    await ethers.provider.send("evm_setNextBlockTimestamp", [now+7200+86401]);
    await insurance.expirePolicy(1);
    expect((await nft.getPolicy(1)).status).to.equal(3n);
  });
  it("keeps NAV and fair LP issuance independent of locked coverage", async function () {
    const { purchase, pool, usdc, buyer, unit } = await fixture();
    const before=await pool.totalAssets(); await purchase();
    expect(await pool.totalAssets()).to.equal(before);
    await usdc.connect(buyer).approve(pool.target,100n*unit);
    await pool.connect(buyer).deposit(100n*unit,buyer.address);
    expect(await pool.liquidity(buyer.address)).to.equal(100n*unit);
    await pool.connect(buyer).withdraw(100n*unit,buyer.address);
    expect(await pool.totalAssets()).to.equal(before);
  });
  it("rejects repriced, transferred and post-departure listings", async function () {
    const { purchase, market, nft, traveler, buyer, outsider, ethers, now, unit } = await fixture();
    await purchase(); await market.connect(traveler).list(1,50n*unit);
    await expect(market.connect(buyer).buy(1,49n*unit)).to.be.revertedWithCustomError(market,"InvalidListing");
    await nft.connect(traveler).transferFrom(traveler.address,outsider.address,1);
    await expect(market.connect(buyer).buy(1,50n*unit)).to.be.revertedWithCustomError(market,"ListingStale");
    await ethers.provider.send("evm_setNextBlockTimestamp",[now+3600]);
    await expect(market.connect(outsider).list(1,50n*unit)).to.be.revertedWithCustomError(market,"InvalidListing");
  });
  it("conserves reserves across 20 deterministic mixed settlement operations", async function () {
    const { insurance, traveler, usdc, pool, unit, now, oracle, ethers } = await fixture();
    await usdc.mint(traveler.address,1000n*unit);
    await usdc.connect(traveler).approve(pool.target,1000n*unit);
    for(let i=0;i<20;i++) await insurance.connect(traveler).purchasePolicy("CX528",now+3600,now+3600,now+7200,100n*unit,2n*unit,unit);
    const initial=await usdc.balanceOf(pool.target);
    await ethers.provider.send("evm_setNextBlockTimestamp",[now+3600]);
    for(let i=1;i<=20;i+=2) {
      await oracle.reportDelay(i,60);
      expect(await usdc.balanceOf(pool.target)).to.be.gte((await pool.totalLockedCoverage())+(await pool.totalRefundReserve()));
    }
    await ethers.provider.send("evm_setNextBlockTimestamp",[now+7200+86401]);
    for(let i=2;i<=20;i+=2) await insurance.expirePolicy(i);
    expect(await pool.totalLockedCoverage()).to.equal(0n);
    expect(await pool.totalRefundReserve()).to.equal(0n);
    expect(await pool.totalPendingRiskFee()).to.equal(0n);
    expect(await usdc.balanceOf(pool.target)).to.equal(initial-1010n*unit);
  });
  it("blocks reentry through the policy NFT safe-mint callback", async function () {
    const { ethers, insurance, usdc, now, unit } = await fixture();
    const receiver=await ethers.deployContract("ReentrantBuyer",[insurance.target]);
    await usdc.mint(receiver.target,100n*unit);
    await receiver.purchase(now+3600);
    expect(await receiver.blocked()).to.equal(true);
    expect(await receiver.callbackError()).to.equal(ethers.id("ReentrancyGuardReentrantCall()").slice(0,10));
    expect(await insurance.nextPolicyId()).to.equal(2n);
  });
  it("rejects unauthorized reserve withdrawals and accounting calls", async function () {
    const { pool, outsider } = await fixture();
    await expect(pool.connect(outsider).payClaim(1,outsider.address)).to.be.revertedWithCustomError(pool,"AccessControlUnauthorizedAccount");
    await expect(pool.connect(outsider).fundPolicy(1,outsider.address,20,1000,10)).to.be.revertedWithCustomError(pool,"AccessControlUnauthorizedAccount");
  });
  it("rejects zero-share donation dilution without taking the victim deposit", async function () {
    const { ethers, usdc, admin, outsider, buyer } = await fixture();
    const fresh=await ethers.deployContract("InsurancePool",[usdc.target,admin.address]);
    await usdc.mint(outsider.address,1001);
    await usdc.connect(outsider).approve(fresh.target,1);
    await fresh.connect(outsider).deposit(1,outsider.address);
    await usdc.connect(outsider).transfer(fresh.target,1000);
    await usdc.connect(buyer).approve(fresh.target,100);
    const before=await usdc.balanceOf(buyer.address);
    await expect(fresh.connect(buyer).deposit(100,buyer.address)).to.be.revertedWithCustomError(fresh,"ZeroAmount");
    expect(await usdc.balanceOf(buyer.address)).to.equal(before);
    await fresh.connect(outsider).withdraw(1,outsider.address);
    expect(await usdc.balanceOf(outsider.address)).to.equal(501n);
  });
});
