// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/**
 * @title IBulkSender
 * @dev Interface for bulk sending ERC20, ERC721, and ERC1155 tokens
 */
interface IBulkSender {
    // Events
    event BulkERC20Transfer(
        address indexed token,
        address indexed sender,
        uint256 totalAmount,
        uint256 recipientCount
    );
    
    event BulkERC721Transfer(
        address indexed token,
        address indexed sender,
        uint256[] tokenIds,
        address[] recipients
    );
    
    event BulkERC1155Transfer(
        address indexed token,
        address indexed sender,
        uint256[] tokenIds,
        uint256[] amounts,
        address[] recipients
    );
        
    // No structs needed for simplified interface
    
    // ERC20 Bulk Operations
    /**
     * @dev Send same ERC20 token to multiple recipients with same amount each
     * @param token The ERC20 token contract address
     * @param recipients Array of recipient addresses
     * @param amount Amount to send to each recipient
     */
    function bulkSendERC20Equal(
        address token,
        address[] calldata recipients,
        uint256 amount
    ) external payable;
    
    /**
     * @dev Send same ERC20 token to multiple recipients with different amounts
     * @param token The ERC20 token contract address
     * @param recipients Array of recipient addresses
     * @param amounts Array of amounts corresponding to each recipient
     */
    function bulkSendERC20Different(
        address token,
        address[] calldata recipients,
        uint256[] calldata amounts
    ) external payable;
    
    // ERC721 Bulk Operations
    /**
     * @dev Send multiple ERC721 tokens to multiple recipients
     * @param token The ERC721 token contract address
     * @param recipients Array of recipient addresses
     * @param tokenIds Array of token IDs to transfer
     */
    function bulkSendERC721(
        address token,
        address[] calldata recipients,
        uint256[] calldata tokenIds
    ) external payable;
    
    // ERC1155 Bulk Operations
    /**
     * @dev Send same ERC1155 token ID to multiple recipients
     * @param token The ERC1155 token contract address
     * @param recipients Array of recipient addresses
     * @param tokenId The token ID to transfer
     * @param amounts Array of amounts for each recipient
     * @param data Additional data to pass to recipients
     */
    function bulkSendERC1155(
        address token,
        address[] calldata recipients,
        uint256 tokenId,
        uint256[] calldata amounts,
        bytes calldata data
    ) external payable;
    
    /**
     * @dev Send multiple different ERC1155 tokens with different IDs
     * @param token The ERC1155 token contract address
     * @param recipients Array of recipient addresses
     * @param tokenIds Array of token IDs to transfer
     * @param amounts Array of amounts for each transfer
     * @param data Additional data to pass to recipients
     */
    function bulkSendERC1155Different(
        address token,
        address[] calldata recipients,
        uint256[] calldata tokenIds,
        uint256[] calldata amounts,
        bytes calldata data
    ) external payable;
    
    // Administrative functions
    
    /**
     * @dev Set the maximum number of recipients per bulk call (only owner)
     * @param newLimit New maximum number of recipients
     */
    function setRecipientLimit(uint256 newLimit) external;
    
    /**
     * @dev Get current recipient limit per bulk call
     * @return Current maximum number of recipients allowed per call
     */
    function getRecipientLimit() external view returns (uint256);
    
    // Emergency functions
    /**
     * @dev Emergency withdrawal of tokens sent to contract by mistake
     * @param token Token contract address (address(0) for ETH)
     * @param to Recipient address
     * @param amount Amount to withdraw
     */
    function emergencyWithdraw(
        address token,
        address to,
        uint256 amount
    ) external;
    
    /**
     * @dev Pause/unpause contract functionality
     * @param paused New pause state
     */
    function setPaused(bool paused) external;
    
    /**
     * @dev Check if contract is paused
     * @return True if contract is paused
     */
    function isPaused() external view returns (bool);
}