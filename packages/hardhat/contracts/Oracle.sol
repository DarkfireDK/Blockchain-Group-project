// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

interface IInsurance {
    function onDelayReported(uint256 policyId, uint32 delayMinutes) external;
}

contract Oracle is AccessControl, ReentrancyGuard {
    bytes32 public constant REPORTER_ROLE = keccak256("REPORTER_ROLE");

    IInsurance public immutable insurance;

    mapping(uint256 => bool) public reported;

    event DelayReported(uint256 indexed policyId, uint32 delayMinutes, address indexed reporter);

    error AlreadyReported(uint256 policyId);
    error InvalidReport();

    constructor(address insurance_, address admin) {
        require(insurance_.code.length > 0 && admin != address(0), "invalid setup");
        insurance = IInsurance(insurance_);
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
    }

    /**
     * @notice 报告航班延误
     * @dev 只有 REPORTER_ROLE 能调用，每张保单只能报一次
     */
    function reportDelay(uint256 policyId, uint32 delayMinutes)
        external
        onlyRole(REPORTER_ROLE)
        nonReentrant
    {
        if (reported[policyId]) revert AlreadyReported(policyId);
        if (delayMinutes == 0) revert InvalidReport();

        reported[policyId] = true;
        insurance.onDelayReported(policyId, delayMinutes);

        emit DelayReported(policyId, delayMinutes, msg.sender);
    }
}
