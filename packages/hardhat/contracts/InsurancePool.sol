// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/math/Math.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract InsurancePool is AccessControl, ReentrancyGuard {
    using SafeERC20 for IERC20;
    error ZeroAmount();
    error InsufficientLiquidity(uint256 available, uint256 required);
    error PolicyAlreadyFunded(uint256 policyId);
    error PolicyNotActive(uint256 policyId);
    bytes32 public constant INSURER_ROLE = keccak256("INSURER_ROLE");
    IERC20 public immutable usdc;
    uint256 public totalLiquidity;
    mapping(address => uint256) public liquidity;
    uint256 public totalLockedCoverage;
    uint256 public totalRefundReserve;
    uint256 public totalPendingRiskFee;
    struct PolicyReserve {
        uint256 coverageAmount;
        uint256 refundableAmount;
        bool active;
        uint256 riskFee;
        bool used;
    }
    mapping(uint256 => PolicyReserve) public policyReserves;
    event Deposited(address indexed provider, uint256 amount, uint256 shares);
    event Withdrawn(address indexed provider, uint256 shares, uint256 amount);
    event PolicyFunded(uint256 indexed policyId, uint256 coverageAmount, uint256 refundableAmount);
    event ClaimPaid(uint256 indexed policyId, address indexed beneficiary, uint256 amount);
    event RefundPaid(uint256 indexed policyId, address indexed beneficiary, uint256 amount);

    constructor(address usdc_, address admin) {
        require(usdc_.code.length > 0 && admin != address(0), "invalid setup");
        usdc = IERC20(usdc_);
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
    }
    /// @notice LP NAV excludes all unearned policy premiums; coverage limits withdrawals only.
    function totalAssets() public view returns (uint256) {
        uint256 balance = usdc.balanceOf(address(this));
        uint256 unearned = totalRefundReserve + totalPendingRiskFee;
        return balance > unearned ? balance - unearned : 0;
    }
    /// @notice Conservatively reserve coverage AND refundable premium for every active policy.
    function availableLiquidity() public view returns (uint256) {
        uint256 balance = usdc.balanceOf(address(this));
        uint256 reserved = totalRefundReserve + totalLockedCoverage;
        return balance > reserved ? balance - reserved : 0;
    }
    function deposit(uint256 amount, address receiver) external nonReentrant returns (uint256 shares) {
        if (amount == 0) revert ZeroAmount();
        require(receiver != address(0), "zero receiver");
        uint256 assets = totalAssets();
        require(assets > 0 || totalLiquidity == 0, "insolvent shares");
        // Virtual asset/share prevents cheap first-depositor donation inflation.
        shares = Math.mulDiv(amount, totalLiquidity + 1, assets + 1);
        if (shares == 0) revert ZeroAmount();
        liquidity[receiver] += shares;
        totalLiquidity += shares;
        uint256 beforeBalance = usdc.balanceOf(address(this));
        usdc.safeTransferFrom(msg.sender, address(this), amount);
        require(usdc.balanceOf(address(this)) - beforeBalance == amount, "unsupported token");
        emit Deposited(receiver, amount, shares);
    }
    function withdraw(uint256 shares, address receiver) external nonReentrant returns (uint256 amount) {
        if (shares == 0) revert ZeroAmount();
        require(receiver != address(0), "zero receiver");
        if (shares > liquidity[msg.sender]) revert InsufficientLiquidity(liquidity[msg.sender], shares);
        amount = Math.mulDiv(shares, totalAssets() + 1, totalLiquidity + 1);
        if (amount == 0) revert ZeroAmount();
        uint256 available = availableLiquidity();
        if (amount > available) revert InsufficientLiquidity(available, amount);
        liquidity[msg.sender] -= shares;
        totalLiquidity -= shares;
        usdc.safeTransfer(receiver, amount);
        emit Withdrawn(msg.sender, shares, amount);
    }
    function fundPolicy(uint256 policyId, address payer, uint256 premium, uint256 coverageAmount, uint256 refundableAmount)
        external onlyRole(INSURER_ROLE) nonReentrant {
        if (policyReserves[policyId].used) revert PolicyAlreadyFunded(policyId);
        if (premium == 0 || coverageAmount == 0) revert ZeroAmount();
        require(refundableAmount <= premium, "invalid refund");
        uint256 available = availableLiquidity();
        if (available < coverageAmount) revert InsufficientLiquidity(available, coverageAmount);
        policyReserves[policyId] = PolicyReserve(coverageAmount, refundableAmount, true, premium - refundableAmount, true);
        totalLockedCoverage += coverageAmount;
        totalRefundReserve += refundableAmount;
        totalPendingRiskFee += premium - refundableAmount;
        uint256 beforeBalance = usdc.balanceOf(address(this));
        usdc.safeTransferFrom(payer, address(this), premium);
        require(usdc.balanceOf(address(this)) - beforeBalance == premium, "unsupported token");
        emit PolicyFunded(policyId, coverageAmount, refundableAmount);
    }
    function _close(uint256 policyId) private returns (PolicyReserve memory r) {
        r = policyReserves[policyId];
        if (!r.active) revert PolicyNotActive(policyId);
        policyReserves[policyId].active = false;
        totalLockedCoverage -= r.coverageAmount;
        totalRefundReserve -= r.refundableAmount;
        totalPendingRiskFee -= r.riskFee;
    }
    function payClaim(uint256 policyId, address beneficiary) external onlyRole(INSURER_ROLE) nonReentrant {
        PolicyReserve memory r = _close(policyId);
        usdc.safeTransfer(beneficiary, r.coverageAmount);
        emit ClaimPaid(policyId, beneficiary, r.coverageAmount);
    }
    function payExpiryRefund(uint256 policyId, address beneficiary) external onlyRole(INSURER_ROLE) nonReentrant {
        PolicyReserve memory r = _close(policyId);
        usdc.safeTransfer(beneficiary, r.refundableAmount);
        emit RefundPaid(policyId, beneficiary, r.refundableAmount);
    }
}
