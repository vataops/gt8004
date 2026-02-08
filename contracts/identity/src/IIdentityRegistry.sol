// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title IIdentityRegistry - ERC-8004 Identity Registry Interface
/// @notice Manages on-chain agent identity as ERC-721 NFTs
interface IIdentityRegistry {
    event AgentRegistered(uint256 indexed tokenId, address indexed wallet, string agentURI);
    event AgentUpdated(uint256 indexed tokenId, string agentURI);
    event AgentDeregistered(uint256 indexed tokenId);

    /// @notice Register a new agent identity
    /// @param agentURI URI pointing to the agent's registration file (e.g., /.well-known/agent.json)
    /// @return tokenId The minted ERC-721 token ID representing the agent
    function register(string calldata agentURI) external returns (uint256 tokenId);

    /// @notice Update the agent's registration URI
    /// @param tokenId The agent's token ID
    /// @param agentURI New URI for the agent's registration file
    function update(uint256 tokenId, string calldata agentURI) external;

    /// @notice Deregister an agent (burns the token)
    /// @param tokenId The agent's token ID
    function deregister(uint256 tokenId) external;

    /// @notice Get the agent's registration URI
    /// @param tokenId The agent's token ID
    /// @return The agent's registration file URI
    function getAgentURI(uint256 tokenId) external view returns (string memory);

    /// @notice Get the wallet address associated with an agent
    /// @param tokenId The agent's token ID
    /// @return The agent's wallet address
    function getAgentWallet(uint256 tokenId) external view returns (address);

    /// @notice Get the owner of an agent token (ERC-721)
    /// @param tokenId The agent's token ID
    /// @return The owner address
    function ownerOf(uint256 tokenId) external view returns (address);
}
