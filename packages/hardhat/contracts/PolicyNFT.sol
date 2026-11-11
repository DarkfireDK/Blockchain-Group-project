// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

contract PolicyNFT is ERC721, AccessControl {
    bytes32 public constant INSURER_ROLE = keccak256("INSURER_ROLE");

    enum Status {
        None,
        Active,
        Claimed,
        Expired
    }

    struct Policy {
        string flightNumber;
        uint64 departureDate;
        uint64 coverageStart;
        uint64 coverageEnd;
        uint256 coverageAmount;
        uint256 premium;
        uint256 riskFee;
        uint256 refundableAmount;
        Status status;
    }

    mapping(uint256 => Policy) private s_policies;

    event PolicyMinted(uint256 indexed policyId, address indexed owner);
    event PolicyFinalized(uint256 indexed policyId, Status finalStatus);

    error InvalidPolicy();
    error PolicyNotActive(uint256 policyId);

    constructor(address admin) ERC721("Flight Delay Policy", "FDP") {
        require(admin != address(0), "zero admin");
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
    }

    /**
     * @notice 铸造一张保单 NFT
     */
    function mint(
        address to,
        uint256 policyId,
        Policy calldata policy
    ) external onlyRole(INSURER_ROLE) {
        if (to == address(0)) revert InvalidPolicy();
        if (policy.status != Status.Active) revert InvalidPolicy();

        s_policies[policyId] = policy;
        _safeMint(to, policyId);

        emit PolicyMinted(policyId, to);
    }

    /**
     * @notice 销毁一张保单 NFT，并记录最终状态
     */
    function burn(uint256 policyId, Status finalStatus)
        external
        onlyRole(INSURER_ROLE)
    {
        if (finalStatus != Status.Claimed && finalStatus != Status.Expired) revert InvalidPolicy();
        if (s_policies[policyId].status != Status.Active) {
            revert PolicyNotActive(policyId);
        }
        s_policies[policyId].status = finalStatus;
        _burn(policyId);

        emit PolicyFinalized(policyId, finalStatus);
    }

    /**
     * @notice 读取保单信息
     */
    function getPolicy(uint256 policyId)
        external
        view
        returns (Policy memory policy)
    {
        return s_policies[policyId];
    }

    /**
     * @notice 解决 ERC721 和 AccessControl 的 supportsInterface 冲突
     */
    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC721, AccessControl)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
}