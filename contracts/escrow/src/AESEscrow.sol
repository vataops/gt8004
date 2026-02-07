// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./IAESEscrow.sol";

interface IERC20 {
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function transfer(address to, uint256 amount) external returns (bool);
}

contract AESEscrow is IAESEscrow {
    IERC20 public immutable usdc;
    address public owner;

    uint256 public constant CREDIT_RATIO = 1000; // 1 USDC = 1,000 CREDIT
    uint256 public constant EMERGENCY_TIMEOUT = 7 days;

    struct ChannelEscrow {
        uint256 totalDeposited;
        uint256 totalCredits;
        address depositor;
        uint256 depositTime;
        bool settled;
    }

    mapping(bytes32 => ChannelEscrow) public escrows;

    modifier onlyOwner() {
        require(msg.sender == owner, "not owner");
        _;
    }

    constructor(address _usdc) {
        usdc = IERC20(_usdc);
        owner = msg.sender;
    }

    function deposit(bytes32 channelId, uint256 usdcAmount) external {
        require(usdcAmount > 0, "zero amount");
        require(!escrows[channelId].settled, "already settled");

        usdc.transferFrom(msg.sender, address(this), usdcAmount);

        ChannelEscrow storage e = escrows[channelId];
        e.totalDeposited += usdcAmount;
        e.totalCredits += usdcAmount * CREDIT_RATIO;
        e.depositor = msg.sender;
        e.depositTime = block.timestamp;

        emit Deposited(channelId, msg.sender, usdcAmount, usdcAmount * CREDIT_RATIO);
    }

    function topup(bytes32 channelId, uint256 usdcAmount) external {
        require(usdcAmount > 0, "zero amount");
        ChannelEscrow storage e = escrows[channelId];
        require(e.totalDeposited > 0, "channel not found");
        require(!e.settled, "already settled");

        usdc.transferFrom(msg.sender, address(this), usdcAmount);

        e.totalDeposited += usdcAmount;
        e.totalCredits += usdcAmount * CREDIT_RATIO;

        emit ToppedUp(channelId, msg.sender, usdcAmount, usdcAmount * CREDIT_RATIO);
    }

    function settle(
        bytes32 channelId,
        address[] calldata agents,
        uint256[] calldata creditBalances,
        bytes calldata /* hydraStateProof */
    ) external onlyOwner {
        require(agents.length == creditBalances.length, "length mismatch");
        ChannelEscrow storage e = escrows[channelId];
        require(!e.settled, "already settled");

        uint256 totalCreditsDistributed;
        for (uint256 i = 0; i < creditBalances.length; i++) {
            totalCreditsDistributed += creditBalances[i];
        }
        require(totalCreditsDistributed <= e.totalCredits, "credits exceed minted");

        uint256[] memory usdcAmounts = new uint256[](agents.length);
        uint256 totalDistributed;
        for (uint256 i = 0; i < agents.length; i++) {
            usdcAmounts[i] = creditBalances[i] / CREDIT_RATIO;
            if (usdcAmounts[i] > 0) {
                usdc.transfer(agents[i], usdcAmounts[i]);
            }
            totalDistributed += usdcAmounts[i];
        }

        // Return remainder to operator
        uint256 remainder = e.totalDeposited - totalDistributed;
        if (remainder > 0) {
            usdc.transfer(owner, remainder);
        }

        e.settled = true;
        emit Settled(channelId, agents, usdcAmounts);
    }

    function exitParticipant(
        bytes32 channelId,
        address agent,
        uint256 creditBalance,
        bytes calldata /* proof */
    ) external onlyOwner {
        ChannelEscrow storage e = escrows[channelId];
        require(!e.settled, "already settled");

        uint256 usdcAmount = creditBalance / CREDIT_RATIO;
        require(usdcAmount <= e.totalDeposited, "exceeds deposit");

        e.totalDeposited -= usdcAmount;
        e.totalCredits -= creditBalance;

        usdc.transfer(agent, usdcAmount);

        emit ParticipantExited(channelId, agent, usdcAmount);
    }

    function emergencyWithdraw(bytes32 channelId) external {
        ChannelEscrow storage e = escrows[channelId];
        require(msg.sender == e.depositor, "not depositor");
        require(!e.settled, "already settled");
        require(block.timestamp >= e.depositTime + EMERGENCY_TIMEOUT, "timeout not reached");

        uint256 amount = e.totalDeposited;
        e.totalDeposited = 0;
        e.settled = true;

        usdc.transfer(msg.sender, amount);

        emit EmergencyWithdrawal(channelId, msg.sender, amount);
    }
}
