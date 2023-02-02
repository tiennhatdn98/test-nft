// SPDX-License-Identifier: MIT
pragma solidity 0.8.16;

import "@openzeppelin/contracts-upgradeable/token/ERC721/extensions/IERC721MetadataUpgradeable.sol";

interface IERC721 is IERC721MetadataUpgradeable {
	function mint(
		address _to,
		MintParams calldata _params,
		bytes calldata _signature
	) external returns (uint256 tokenId);

	function setTokenURI(uint256 _tokenId, string memory _tokenURI) external;

	function setType(
		uint256 _tokenId,
		TokenType _type,
		bytes memory _signature
	) external;

	function withdraw(
		address _paymentToken,
		address _to,
		uint256 _amount
	) external;

	function transfer(address _from, address _to, uint256 _tokenId) external;

	function buy(uint256 _tokenId) external;

	function donate(uint256 _tokenId, address _to) external;
}

struct MintParams {
	address to; // Recipient address
	address owner; // Local government address
	address royaltyReceiver; // Royalty receiver address
	address paymentToken; // Payment token address
	uint256 price; // Price of token
	uint256 amount; // Amount that user want to pay token
	uint96 royaltyPercent; // Royalty percent
	string tokenURI; // Token URI
	TokenType typeToken; // Type of token
}

struct TokenPayment {
	address paymentToken; // Payment token address
	uint256 price; // Price of token
}

enum TokenType {
	Normal,
	Furusato
}
