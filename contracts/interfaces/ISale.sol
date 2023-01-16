// SPDX-License-Identifier: MIT
pragma solidity 0.8.16;

interface ISale {
	function create(
		address _token,
		uint256[] memory _tokenIds,
		uint256[] memory prices
	) external;

	function update(uint256 _saleId, SaleDetail[] memory _sales) external;

	function buy(uint256 _saleId, uint256 _tokenId) external;
}

struct SaleDetail {
	address token;
	address manager;
	uint256[] tokenIds;
	SaleStatus status;
}

struct SaleToken {
	uint256 tokenId;
	uint256 price;
	address paymentToken;
	TokenStatus status;
}

enum SaleStatus {
	LIVE,
	CANCELLED
}

enum TokenStatus {
	AVAILABLE,
	SOLD
}
