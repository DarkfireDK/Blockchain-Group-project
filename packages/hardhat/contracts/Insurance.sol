// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "./PolicyNFT.sol";
import "./InsurancePool.sol";
import "./MockUSDC.sol";

contract Insurance is AccessControl, ReentrancyGuard, Pausable {
    ///////////////////
    /// Errors ///////
    ///////////////////
    error InvalidPolicyTerms();
    error InvalidOracle();
    error PolicyNotActive(uint256 policyId);
    error CoveragePeriodNotEnded(uint256 policyId);
    error DelayBelowThreshold(uint32 reported, uint32 required);
    error UnauthorizedOracle();
    error InsufficientPoolLiquidity(uint256 available, uint256 required);
    error NotPolicyOwner(uint256 policyId);

    //////////////////////
    /// State Variables //
    //////////////////////
    InsurancePool public immutable pool;
    PolicyNFT public immutable policyNFT;
    MockUSDC public immutable usdc;

    address public oracle;
    uint32 public minDelayMinutes;
    uint256 public nextPolicyId;
    uint256 public constant REPORT_GRACE_PERIOD = 1 days;
    uint256 public constant MIN_COVERAGE = 10e6;
    uint256 public constant MAX_COVERAGE = 5000e6;
    mapping(uint256 => uint32) public policyMinDelay;
    mapping(uint256 => address) public policyOracle;
    error OutsideReportWindow();

    ////////////////
    /// Events /////
    ////////////////
    event PolicyPurchased(
        uint256 indexed policyId,
        address indexed buyer,
        string flightNumber,
        uint256 coverageAmount,
        uint256 premium
    );
    event ClaimProcessed(uint256 indexed policyId, address indexed beneficiary, uint256 amount);
    event PolicyExpired(uint256 indexed policyId, address indexed beneficiary, uint256 refundAmount);
    event OracleUpdated(address indexed oldOracle, address indexed newOracle);
    event MinDelayUpdated(uint32 oldValue, uint32 newValue);

    ///////////////////
    /// Constructor ///
    ///////////////////
    constructor(
        address pool_,
        address policyNFT_,
        address usdc_,
        address admin,
        uint32 minDelayMinutes_
    ) {
        require(pool_.code.length > 0 && policyNFT_.code.length > 0 && usdc_.code.length > 0 && admin != address(0), "invalid setup");
        require(minDelayMinutes_ > 0, "zero threshold");
        pool = InsurancePool(pool_);
        policyNFT = PolicyNFT(policyNFT_);
        usdc = MockUSDC(usdc_);
        minDelayMinutes = minDelayMinutes_;
        nextPolicyId = 1;
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
    }

    ///////////////////////
    /// 买保单 ///////////
    ///////////////////////

    /**
     * @notice 用户买保单
     * @dev 用户需要先 approve 池子，允许池子划走保费
     */
    function purchasePolicy(
        string calldata flightNumber,
        uint64 departureDate,
        uint64 coverageStart,
        uint64 coverageEnd,
        uint256 coverageAmount,
        uint256 premium,
        uint256 refundableAmount
    ) external nonReentrant whenNotPaused returns (uint256 policyId) {
        // 1. 校验参数
        (uint256 quotedPremium, uint256 quotedRefund) = quotePolicy(coverageAmount);
        if (premium != quotedPremium || refundableAmount != quotedRefund) revert InvalidPolicyTerms();
        if (bytes(flightNumber).length < 2 || bytes(flightNumber).length > 12) revert InvalidPolicyTerms();
        if (oracle == address(0)) revert InvalidOracle();
        if (refundableAmount > premium) revert InvalidPolicyTerms();
        if (coverageStart >= coverageEnd) revert InvalidPolicyTerms();
        if (coverageStart <= block.timestamp || departureDate < coverageStart || departureDate >= coverageEnd) revert InvalidPolicyTerms();
        if (coverageEnd - coverageStart > 7 days) revert InvalidPolicyTerms();

        // 2. 检查池子有没有能力承担这张保单（关键！）
        uint256 available = pool.availableLiquidity();
        if (available < coverageAmount) {
            revert InsufficientPoolLiquidity(available, coverageAmount);
        }

        // 3. 生成 policyId
        policyId = nextPolicyId;
        nextPolicyId++;
        policyMinDelay[policyId] = minDelayMinutes;
        policyOracle[policyId] = oracle;

        // 4. 从用户收保费，锁定保额和退款准备金
        pool.fundPolicy(policyId, msg.sender, premium, coverageAmount, refundableAmount);

        // 5. 铸造保单 NFT
        PolicyNFT.Policy memory policy = PolicyNFT.Policy({
            flightNumber: flightNumber,
            departureDate: departureDate,
            coverageStart: coverageStart,
            coverageEnd: coverageEnd,
            coverageAmount: coverageAmount,
            premium: premium,
            riskFee: premium - refundableAmount,
            refundableAmount: refundableAmount,
            status: PolicyNFT.Status.Active
        });
        policyNFT.mint(msg.sender, policyId, policy);

        emit PolicyPurchased(policyId, msg.sender, flightNumber, coverageAmount, premium);
        return policyId;
    }

    ///////////////////////
    /// Oracle 报告 //////
    ///////////////////////

    /**
     * @notice Oracle 报告航班延误
     * @dev 只有 oracle 地址能调用
     */
    function onDelayReported(uint256 policyId, uint32 delayMinutes)
        external
        nonReentrant
    {
        if (msg.sender != policyOracle[policyId]) revert UnauthorizedOracle();

        PolicyNFT.Policy memory policy = policyNFT.getPolicy(policyId);
        if (policy.status != PolicyNFT.Status.Active) {
            revert PolicyNotActive(policyId);
        }

        if (block.timestamp < policy.departureDate || block.timestamp > uint256(policy.coverageEnd) + REPORT_GRACE_PERIOD) revert OutsideReportWindow();
        // 延误没到门槛 → 不赔，保单继续有效
        if (delayMinutes < policyMinDelay[policyId]) {
            revert DelayBelowThreshold(delayMinutes, policyMinDelay[policyId]);
        }

        // 触发赔付
        address beneficiary = policyNFT.ownerOf(policyId);
        policyNFT.burn(policyId, PolicyNFT.Status.Claimed);
        pool.payClaim(policyId, beneficiary);

        emit ClaimProcessed(policyId, beneficiary, policy.coverageAmount);
    }

    ///////////////////////
    /// 到期退款 ////////
    ///////////////////////

    /**
     * @notice 保险期结束，没出险 → 退可退金额
     * @dev 任何人都能触发（给 keeper 用）
     */
    function expirePolicy(uint256 policyId) external nonReentrant {
        PolicyNFT.Policy memory policy = policyNFT.getPolicy(policyId);
        if (policy.status != PolicyNFT.Status.Active) {
            revert PolicyNotActive(policyId);
        }

        // 必须已过保险期
        if (block.timestamp <= uint256(policy.coverageEnd) + REPORT_GRACE_PERIOD) {
            revert CoveragePeriodNotEnded(policyId);
        }

        // 退款给当前 NFT 持有人
        address beneficiary = policyNFT.ownerOf(policyId);
        policyNFT.burn(policyId, PolicyNFT.Status.Expired);
        pool.payExpiryRefund(policyId, beneficiary);

        emit PolicyExpired(policyId, beneficiary, policy.refundableAmount);
    }

    ///////////////////////
    /// 管理函数 ////////
    ///////////////////////

    /// @notice Classroom tariff: 2% premium, half refundable. Not an actuarial quotation.
    function quotePolicy(uint256 coverage) public pure returns (uint256 premium, uint256 refundable) {
        if (coverage < MIN_COVERAGE || coverage > MAX_COVERAGE) revert InvalidPolicyTerms();
        premium = (coverage + 49) / 50;
        refundable = premium / 2;
    }
    function pause() external onlyRole(DEFAULT_ADMIN_ROLE) { _pause(); }
    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) { _unpause(); }
    function setOracle(address newOracle) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (newOracle.code.length == 0) revert InvalidOracle();
        address old = oracle;
        oracle = newOracle;
        emit OracleUpdated(old, newOracle);
    }

    function setMinDelayMinutes(uint32 newValue) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(newValue > 0, "zero threshold");
        uint32 old = minDelayMinutes;
        minDelayMinutes = newValue;
        emit MinDelayUpdated(old, newValue);
    }
}