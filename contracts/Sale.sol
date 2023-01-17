// SPDX-License-Identifier: MIT
pragma solidity 0.8.16;

import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC721/IERC721Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/StringsUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/CountersUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/AddressUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";
import "./interfaces/ISale.sol";
import "./Authorizable.sol";
import "./ERC721.sol";

contract Sale is Authorizable, ReentrancyGuardUpgradeable {
	using SafeERC20Upgradeable for IERC20Upgradeable;
	using CountersUpgradeable for CountersUpgradeable.Counter;
	using StringsUpgradeable for uint256;
	using AddressUpgradeable for address payable;
	using AddressUpgradeable for address;

	/**
	 * @notice Last ID of sale
	 */
	CountersUpgradeable.Counter public lastId;

	/**
	 * @notice Mapping sale ID to sale detail
	 */
	mapping(uint256 => SaleDetail) public sales;

	/**
	 * @notice Mapping sale ID to token ID to token detail
	 */
	mapping(uint256 => mapping(uint256 => SaleToken)) tokens;

	/**
	 * @notice Emit event when a sale is created
	 */
	event Created(uint256 indexed saleId, SaleDetail sale);

	/**
	 * @notice Emit event when a sale is updated
	 */
	event Update(uint256 indexed saleId, SaleDetail[] sales);

	/**
	 * @notice Emit event when contract is deployed
	 */
	event Bought(
		address indexed buyer,
		uint256 indexed saleId,
		uint256 indexed tokenId,
		uint256 price
	);

	event Cancelled(uint256 saleId);

	/**
	 *  @notice Update new base URI
	 *
	 *  @dev    Only owner or controller can call this function
	 *
	 *  Emit event {Deployed}
	 */
	function initialize(address _owner) public initializer {
		ReentrancyGuardUpgradeable.__ReentrancyGuard_init();
		__Ownable_init();
		transferOwnership(_owner);
	}

	modifier onlyValidSale(uint256 _saleId) {
		require(_saleId > 0 && _saleId <= lastId.current(), "Nonexistent sale");
		_;
	}

	function isAvaiableSale(uint256 _saleId) private view returns (bool) {
		return sales[_saleId].status == SaleStatus.LIVE;
	}

	function create(
		address _token,
		uint256[] memory _tokenIds,
		address[] memory _tokenPayments,
		uint256[] memory _prices
	) external {
		require(_token != address(0), "Invalid token address");
		require(_tokenIds.length > 0, "Empty token ids");
		require(_tokenIds.length <= 50, "Limit length");
		require(
			_tokenIds.length == _prices.length &&
				_tokenIds.length == _tokenPayments.length,
			"Inconsistent length"
		);
		lastId.increment();
		for (uint256 i = 0; i < _tokenIds.length; i++) {
			require(_prices[i] > 0, "Invalid price");
			tokens[lastId.current()][_tokenIds[i]] = SaleToken(
				_tokenIds[i],
				_prices[i],
				_tokenPayments[i],
				TokenStatus.AVAILABLE
			);
		}
		sales[lastId.current()] = SaleDetail(
			_token,
			_msgSender(),
			_tokenIds,
			SaleStatus.LIVE
		);
		emit Created(lastId.current(), sales[lastId.current()]);
	}

	function update(
		uint256 _saleId,
		SaleToken[] memory _tokens
	) external onlyValidSale(_saleId) {
		require(
			_msgSender() == sales[_saleId].manager,
			"Caller is must be manager of sale"
		);
		require(sales[_saleId].status == SaleStatus.LIVE, "Sale was cancelled");
		require(_tokens.length > 0, "Empty token ids");
		require(_tokens.length <= 50, "Limit length");
		for (uint256 i = 0; i < _tokens.length; i++) {
			require(
				tokens[_saleId][_tokens[i].tokenId].status != TokenStatus.SOLD,
				"Token is sold"
			);
			require(_tokens[i].price > 0, "Invalid price");
			tokens[_saleId][_tokens[i].tokenId] = _tokens[i];
		}
	}

	function buy(
		uint256 _saleId,
		uint256 _tokenId
	) external payable onlyValidSale(_saleId) nonReentrant {
		require(sales[_saleId].status == SaleStatus.LIVE, "Sale is cancelled");
		require(
			tokens[_saleId][_tokenId].status == TokenStatus.AVAILABLE,
			"Token is sold"
		);
		tokens[_saleId][_tokenId].status = TokenStatus.SOLD;
		// Send money to token owner
		address paymentToken = tokens[_saleId][_tokenId].paymentToken;
		if (paymentToken == address(0)) {
			payable(IERC721Upgradeable(sales[_saleId].token).ownerOf(_tokenId))
				.sendValue(tokens[_saleId][_tokenId].price);
		} else {
			IERC20Upgradeable(tokens[_saleId][_tokenId].paymentToken)
				.safeTransferFrom(
					address(this),
					IERC721Upgradeable(sales[_saleId].token).ownerOf(_tokenId),
					tokens[_saleId][_tokenId].price
				);
		}
	}

	function cancel(uint256 _saleId) external onlyValidSale(_saleId) {
		require(
			_msgSender() == sales[_saleId].manager,
			"Caller is not manager of sale"
		);
		require(
			sales[_saleId].status != SaleStatus.CANCELLED,
			"Sale is already cancelled"
		);
		sales[_saleId].status = SaleStatus.CANCELLED;
		emit Cancelled(_saleId);
	}

	function getTokenIds(
		uint256 _saleId
	) external view returns (uint256[] memory) {
		return sales[_saleId].tokenIds;
	}
}
