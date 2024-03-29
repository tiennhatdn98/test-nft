// SPDX-License-Identifier: MIT
pragma solidity 0.8.16;

import "@openzeppelin/contracts-upgradeable/token/ERC721/extensions/IERC721MetadataUpgradeable.sol";

interface IERC721 is IERC721MetadataUpgradeable {
	function mint(
		address _to,
		TokenDetail memory _tokenInput,
		bytes memory _signature
	) external returns (uint256 tokenId);

	function mintWithRoyalty(
		address _to,
		TokenDetail memory _tokenInput,
		bytes memory _signature,
		address _royaltyReceiver
	) external returns (uint256 tokenId);

	function setTokenURI(uint256 _tokenId, string memory _tokenURI) external;

	function setTokenStatus(uint256 _tokenId, bool status) external;

	function withdraw(
		address _paymentToken,
		address _to,
		uint256 _amount
	) external;

	function claim(
		address _paymentToken,
		address _to,
		uint256 _amount
	) external;

	function transfer(address _from, address _to, uint256 _tokenId) external;

	function buy(uint256 _tokenId) external;
}

struct TokenDetail {
	uint256 tokenId;
	uint256 amount; // Amount of money that user pay
	uint256 price; // Amount of money that need to mint
	address paymentToken; // Zero address when paying native token
	address owner;
	string tokenURI;
	bool status; // true is ACTIVE, false is DEACTIVE
}

struct TokenPayment {
	address paymentToken;
	uint256 price;
}
