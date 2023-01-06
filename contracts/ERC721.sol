// SPDX-License-Identifier: MIT
pragma solidity 0.8.17;

import "@openzeppelin/contracts-upgradeable/token/ERC721/ERC721Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC721/extensions/ERC721EnumerableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/common/ERC2981Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/StringsUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/CountersUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";
import "./libraries/Helper.sol";
import "./Authorizable.sol";
import "./interfaces/IERC721.sol";
import "./VerifySignature.sol";

contract ERC721 is
	ERC721Upgradeable,
	// ERC721EnumerableUpgradeable,
	ERC2981Upgradeable,
	Authorizable,
	VerifySignature,
	ReentrancyGuardUpgradeable
{
	using SafeERC20Upgradeable for IERC20Upgradeable;

	using StringsUpgradeable for uint256;

	using CountersUpgradeable for CountersUpgradeable.Counter;

	/**
	 * @notice Last ID of token
	 */
	CountersUpgradeable.Counter public lastId;

	/**
	 * @notice Default royalty info
	 */
	RoyaltyInfo public defaultRoyaltyInfo;

	/**
	 * @notice expiration uint256 is expired period of token
	 */
	uint256 public expiration;

	mapping(uint256 => TokenInfo) public tokens;

	/**
	 * @notice Mapping token ID expiration timestamp to store expired timestamp of each token
	 */
	mapping(uint256 => uint256) public expirationOf;

	/**
	 * @notice Mapping token ID to boolean to store status of each token (active or deactive)
	 */
	mapping(uint256 => bool) public statusOf;

	/**
	 * @notice Mapping token address to owner address to balance to store balance of token of each address
	 */
	mapping(address => mapping(address => uint256)) public ownerBalanceOf;

	/**
	 * @notice Mapping token address to change amount when mint token
	 */
	mapping(address => uint256) public changeOf;

	/**
	 * @notice Mapping token ID and URI to store token URIs
	 */
	// mapping(uint256 => string) private _tokenURIs;

	/**
	 * @notice Mapping signature to token ID
	 */
	mapping(bytes => uint256) public tokenIdOf;

	/**
	 * @notice Emit event when contract is deployed
	 */
	event Deployed(
		address indexed owner,
		string tokenName,
		string symbol,
		uint256 expiration,
		address royaltyReceiver,
		uint256 royaltyPercentage
	);

	/**
	 * @notice Emit event when updating metadata of a token
	 */
	// event SetBaseURI(string indexed oldUri, string indexed newUri);

	/**
	 * @notice Emit event when set token URI
	 */
	event SetTokenURI(
		uint256 indexed tokenId,
		string oldTokenURI,
		string newTokenURI
	);

	/**
	 * @notice Emit event when set status of a token
	 */
	event SetTokenStatus(uint256 indexed tokenId, bool status);

	/**
	 * @notice Emit event when set status of a token
	 */
	event SetExpiration(uint256 indexed oldExpiration, uint256 newExpiration);

	/**
	 * @notice Emit event when owner withdraws
	 */
	event Withdrawn(
		address indexed paymentToken,
		address indexed to,
		uint256 amount
	);

	/**
	 * @notice Emit event when someone claims
	 */
	event Claimed(
		address indexed paymentToken,
		address indexed to,
		uint256 amount
	);

	/**
	 * @notice Emit event when someone claims
	 */
	event Bought(address buyer, uint256 tokenId);

	/**
	 *  @notice Update new base URI
	 *
	 *  @dev    Only owner or controller can call this function
	 *
	 *          Name        Meaning
	 *  @param  _owner      Contract owner address
	 *  @param  _tokenName  Token name
	 *  @param  _symbol     Token symbol
	 *
	 *  Emit event {Deployed}
	 */
	function initialize(
		address _owner,
		string memory _tokenName,
		string memory _symbol,
		uint256 _expiration,
		address _royaltyReceiver,
		uint96 _royaltyPercentage
	) public initializer {
		ReentrancyGuardUpgradeable.__ReentrancyGuard_init();
		__ERC721_init(_tokenName, _symbol);
		__Ownable_init();
		transferOwnership(_owner);

		expiration = _expiration;

		if (_royaltyReceiver != address(0)) {
			require(_royaltyPercentage > 0, "Invalid royalty percentage");
			defaultRoyaltyInfo = RoyaltyInfo(
				_royaltyReceiver,
				_royaltyPercentage
			);
			// _setDefaultRoyalty(_royaltyReceiver, _royaltyPercentage);
		}
		emit Deployed(
			_owner,
			_tokenName,
			_symbol,
			_expiration,
			_royaltyReceiver,
			_royaltyPercentage
		);
	}

	/**
	 * @dev See {IERC165-supportsInterface}.
	 */
	function supportsInterface(
		bytes4 interfaceId
	)
		public
		view
		override(ERC721Upgradeable, ERC2981Upgradeable)
		returns (bool)
	{
		return super.supportsInterface(interfaceId);
	}

	/**
	 * @dev Hook that is called before any token transfer. This includes minting
	 * and burning.
	 *
	 * Calling conditions:
	 *
	 * - When `from` and `to` are both non-zero, ``from``'s `tokenId` will be
	 * transferred to `to`.
	 * - When `from` is zero, `tokenId` will be minted for `to`.
	 * - When `to` is zero, ``from``'s `tokenId` will be burned.
	 * - `from` cannot be the zero address.
	 * - `to` cannot be the zero address.
	 *
	 * To learn more about hooks, head to xref:ROOT:extending-contracts.adoc#using-hooks[Using Hooks].
	 */
	// function _beforeTokenTransfer(
	// 	address from,
	// 	address to,
	// 	uint256 tokenId
	// ) internal override(ERC721Upgradeable, ERC721EnumerableUpgradeable) {
	// 	super._beforeTokenTransfer(from, to, tokenId);
	// }

	/**
	 *  @notice Set token URI by token ID
	 *
	 *          Name        Meaning
	 *  @param  _tokenId    Token ID that want to set
	 *  @param  _tokenURI   New token URI that want to set
	 *  @param  _signature  Signature
	 *
	 *  Emit event {SetTokenURI}
	 */
	function setTokenURI(
		uint256 _tokenId,
		string memory _tokenURI,
		bytes memory _signature
	) public {
		require(
			_exists(_tokenId),
			"ERC721Metadata: URI set of nonexistent token"
		);
		TokenInfo memory _tokenInput = TokenInfo(
			_tokenId,
			0,
			0,
			address(0),
			address(0),
			_tokenURI,
			true
		);
		require(
			verify(verifier, _tokenInput, _signature),
			"SetTokenURI: Invalid signature"
		);
		// string memory oldTokenURI = _tokenURIs[_tokenId];
		// _tokenURIs[_tokenId] = _tokenURI;
		string memory oldTokenURI = tokens[_tokenId].tokenURI;
		tokens[_tokenId].tokenURI = _tokenURI;
		tokens[_tokenId].tokenURI = _tokenURI;
		emit SetTokenURI(_tokenId, oldTokenURI, _tokenURI);
	}

	/**
	 *  @notice Set status of token by token ID
	 *
	 *          Name        Meaning
	 *  @param  _tokenId    Token ID that want to set
	 *  @param  _status     New status of token that want to set (true is ACTIVE, false is DEACTIVE)
	 *
	 *  Emit event {SetTokenStatus}
	 */
	function setTokenStatus(
		uint256 _tokenId,
		bool _status,
		bytes memory _signature
	) public {
		require(
			_exists(_tokenId),
			"ERC721Metadata: URI set of nonexistent token"
		);
		require(statusOf[_tokenId] != _status, "Duplicate value");
		TokenInfo memory _tokenInput = TokenInfo(
			_tokenId,
			0,
			0,
			address(0),
			address(0),
			"",
			_status
		);
		require(
			verify(verifier, _tokenInput, _signature),
			"SetTokenStatus: Invalid signature"
		);
		statusOf[_tokenId] = _status;
		tokens[_tokenId].status = _status;
		emit SetTokenStatus(_tokenId, _status);
	}

	/**
	 *  @notice Get token URI by token ID
	 *
	 *          Name        Meaning
	 *  @param  _tokenId    Token ID that want to get token URI
	 *
	 *          Type        Meaning
	 *  @return string      Token URI
	 */
	function tokenURI(
		uint256 _tokenId
	) public view virtual override returns (string memory) {
		require(
			_exists(_tokenId),
			"ERC721Metadata: URI query for nonexistent token."
		);
		return tokens[_tokenId].tokenURI;
	}

	/**
	 *  @notice Set expired period of token
	 *
	 *  @dev    Only admin can call this function
	 *
	 *          Name            Meaning
	 *  @param  _expiration     New expired period of token
	 */
	function setExpiration(uint256 _expiration) public onlyAdmin {
		require(_expiration != 0, "Invalid expired period");
		uint256 oldExpiration = expiration;
		expiration = _expiration;
		emit SetExpiration(oldExpiration, expiration);
	}

	/**
	 *  @notice Mint a token to an address
	 *
	 *  @dev    Only owner or controller can call this function
	 *
	 *          Name                        Meaning
	 *  @param  _to                         Address that want to mint token
	 *  @param  _tokenInput.tokenId         Token ID (default 0)
	 *  @param  _tokenInput.amount          Amount of money that user pay
	 *  @param  _tokenInput.price           Amount of money that need to mint token
	 *  @param  _tokenInput.paymentToken    Payment token address (Zero address if user pay native token)
	 *  @param  _tokenInput.tokenURI        Token URI
	 *  @param  _tokenInput.owner        		Local government address
	 *  @param  _tokenInput.status          Status of token (true is ACTIVE, false is DEACTIVE, default true)
	 *  @param  _signature                  Signature of transaction
	 *
	 *  Emit event {Transfer(address(0), _to, tokenId)}
	 */
	function mint(
		address _to,
		TokenInfo memory _tokenInput,
		bytes memory _signature
	) public payable nonReentrant {
		require(
			_to != address(0) && _tokenInput.owner != address(0),
			"Invalid address"
		);
		require(
			_tokenInput.amount > 0 && _tokenInput.price > 0,
			"Invalid price and amount"
		);
		require(_tokenInput.amount >= _tokenInput.price, "Not enough money");
		if (_tokenInput.paymentToken == address(0)) {
			require(msg.value == _tokenInput.amount, "Invalid amount of money");
		}
		require(_tokenInput.owner != address(0), "Invalid address");
		require(
			verify(verifier, _tokenInput, _signature),
			"Mint: Invalid signature"
		);
		lastId.increment();
		_safeMint(_to, lastId.current());
		// _tokenURIs[lastId.current()] = _tokenInput.tokenURI;
		// Update status
		statusOf[lastId.current()] = true;
		// Update expiration
		expirationOf[lastId.current()] = block.timestamp + expiration;
		// Update owner balance
		ownerBalanceOf[_tokenInput.paymentToken][
			_tokenInput.owner
		] += _tokenInput.price;
		tokenIdOf[_signature] = lastId.current();
		_tokenInput.tokenId = lastId.current();
		tokens[lastId.current()] = _tokenInput;
		if (_tokenInput.amount > _tokenInput.price) {
			changeOf[_tokenInput.paymentToken] +=
				_tokenInput.amount -
				_tokenInput.price;
		}
		if (_tokenInput.paymentToken != address(0)) {
			_handleTransfer(
				_msgSender(),
				address(this),
				_tokenInput.paymentToken,
				_tokenInput.amount
			);
		}
	}

	/**
	 *  @notice Mint a token to an address with royalty
	 *
	 *  @dev    Only owner or controller can call this function
	 *
	 *          Name                        Meaning
	 *  @param  _to                         Address that want to mint token
	 *  @param  _tokenInput.tokenId         Token ID (default 0)
	 *  @param  _tokenInput.amount          Amount of money that user pay
	 *  @param  _tokenInput.price           Amount of money that need to mint token
	 *  @param  _tokenInput.paymentToken    Payment token address (Zero address if user pay native token)
	 *  @param  _tokenInput.tokenURI        Token URI
	 *  @param  _tokenInput.owner        		Local government address
	 *  @param  _tokenInput.status          Status of token (true is ACTIVE, false is DEACTIVE, default true)
	 *  @param  _signature                  Signature of transaction
	 *  @param  _royaltyReceiver            Royalty receiver address
	 *
	 *  Emit event {Transfer(address(0), _to, tokenId)}
	 */
	function mintWithRoyalty(
		address _to,
		TokenInfo memory _tokenInput,
		bytes memory _signature,
		address _royaltyReceiver
	) public payable nonReentrant {
		require(
			_to != address(0) && _tokenInput.owner != address(0),
			"Invalid address"
		);
		require(
			_tokenInput.amount > 0 && _tokenInput.price > 0,
			"Invalid price and amount"
		);
		require(_tokenInput.amount >= _tokenInput.price, "Not enough money");
		if (_tokenInput.paymentToken == address(0)) {
			require(msg.value == _tokenInput.amount, "Invalid amount of money");
		}
		require(_tokenInput.owner != address(0), "Invalid address");
		require(
			verify(verifier, _tokenInput, _signature),
			"Mint: Invalid signature"
		);
		lastId.increment();
		_safeMint(_to, lastId.current());
		// _tokenURIs[lastId.current()] = _tokenInput.tokenURI;
		statusOf[lastId.current()] = true;
		expirationOf[lastId.current()] = block.timestamp + expiration;
		tokenIdOf[_signature] = lastId.current();
		_tokenInput.tokenId = lastId.current();
		tokens[lastId.current()] = _tokenInput;
		_royaltyReceiver == address(0)
			? _setTokenRoyalty(
				lastId.current(),
				defaultRoyaltyInfo.receiver,
				defaultRoyaltyInfo.royaltyFraction
			)
			: _setTokenRoyalty(
				lastId.current(),
				_royaltyReceiver,
				defaultRoyaltyInfo.royaltyFraction
			);
		(, uint256 royaltyFraction) = royaltyInfo(
			lastId.current(),
			_tokenInput.price
		);
		ownerBalanceOf[_tokenInput.paymentToken][
			_tokenInput.owner
		] += (_tokenInput.price - royaltyFraction);
		if (_tokenInput.amount > _tokenInput.price) {
			changeOf[_tokenInput.paymentToken] +=
				_tokenInput.amount -
				_tokenInput.price;
		}
		if (_tokenInput.paymentToken != address(0)) {
			_handleTransfer(
				_msgSender(),
				address(this),
				_tokenInput.paymentToken,
				_tokenInput.amount
			);
		}
	}

	/**
	 *  @notice Owner withdraw money in contract
	 *
	 *  @dev    Only owner can call this function
	 *
	 *          Name            Meaning
	 *  @param  _paymentToken   Address of token that want to withdraw (Zero address if withdraw native token)
	 *  @param  _to             Recipient address
	 *  @param  _amount         Amount of payment token that want to withdraw
	 *
	 *  Emit event {Withdrawn}
	 */
	function withdraw(
		address _paymentToken,
		address _to,
		uint256 _amount
	) external nonReentrant onlyOwner {
		require(_to != address(0), "Invalid address");
		require(
			_amount > 0 && _amount <= changeOf[_paymentToken],
			"Invalid amount"
		);
		changeOf[_paymentToken] -= _amount;
		_paymentToken == address(0)
			? Helper.safeTransferNative(_to, _amount)
			: IERC20Upgradeable(_paymentToken).safeTransfer(_to, _amount);
		emit Withdrawn(_paymentToken, _to, _amount);
	}

	/**
	 *  @notice Local government claims money
	 *
	 *  @dev    Anyone can call this function
	 *
	 *          Name            Meaning
	 *  @param  _paymentToken   Address of token that want tot withdraw (Zero address if claim native token)
	 *  @param  _to             Recipient address
	 *  @param  _amount         Amount of payment token that want to withdraw
	 *
	 *  Emit event {Claimed}
	 */
	function claim(
		address _paymentToken,
		address _to,
		uint256 _amount
	) external nonReentrant {
		require(_to != address(0), "Invalid address");
		require(
			_amount > 0 && _amount <= ownerBalanceOf[_paymentToken][_to],
			"Invalid amount"
		);
		ownerBalanceOf[_paymentToken][_to] -= _amount;
		if (_paymentToken != address(0)) {
			IERC20Upgradeable(_paymentToken).approve(address(this), _amount);
		}
		_handleTransfer(address(this), _to, _paymentToken, _amount);
		emit Claimed(_paymentToken, _to, _amount);
	}

	/**
	 *  @notice Transfer token from an address to another address
	 *
	 *  @dev    Anyone can call this function
	 *
	 *          Name            Meaning
	 *  @param  _to             Recipient address
	 *  @param  _tokenId        Token ID
	 *
	 *  Emit event {Transfer(from, to, tokenId)}
	 */
	function transfer(address _to, uint256 _tokenId) external {
		// TokenInfo memory token = tokens[_tokenId];
		// (address royaltyReceiver, uint256 royaltyFraction) = royaltyInfo(
		// 	_tokenId,
		// 	token.price
		// );
		require(_msgSender() != _to, "Transfer to yourself");
		require(
			_exists(_tokenId),
			"ERC721Metadata: URI query for nonexistent token."
		);
		require(statusOf[_tokenId], "Token is deactive");
		expirationOf[_tokenId] = block.timestamp + expiration;

		// // Transfer token to recipient address
		// safeTransferFrom(_msgSender(), _to, _tokenId);

		// // Transfer royalty fee to royalty receiver
		// if (token.paymentToken != address(0)) {
		// 	IERC20Upgradeable(token.paymentToken).approve(
		// 		address(this),
		// 		royaltyFraction
		// 	);
		// }
		// _handleTransfer(
		// 	address(this),
		// 	royaltyReceiver,
		// 	token.paymentToken,
		// 	royaltyFraction
		// );
	}

	/**
	 *  @notice A user buys a token
	 *
	 *  @dev    Anyone can call this function
	 *
	 *          Name            Meaning
	 *  @param  _tokenId        Token ID
	 *
	 *  Emit event {Bought}
	 */
	function buy(uint256 _tokenId) external payable nonReentrant {
		require(
			_exists(_tokenId),
			"ERC721Metadata: URI query for nonexistent token."
		);
		require(ownerOf(_tokenId) != _msgSender(), "Already owned this token");
		require(statusOf[_tokenId], "Token is deactive");

		TokenInfo memory token = tokens[_tokenId];
		(address royaltyReceiver, uint256 royaltyFraction) = royaltyInfo(
			_tokenId,
			token.price
		);
		// expirationOf[_tokenId] = block.timestamp + expiration;
		_safeTransfer(ownerOf(_tokenId), _msgSender(), _tokenId, "");

		if (token.paymentToken != address(0)) {
			IERC20Upgradeable(token.paymentToken).safeTransfer(
				ownerOf(_tokenId),
				token.price - royaltyFraction
			);
			IERC20Upgradeable(token.paymentToken).safeTransfer(
				royaltyReceiver,
				royaltyFraction
			);
		} else {
			Helper.safeTransferNative(
				ownerOf(_tokenId),
				token.price - royaltyFraction
			);
			Helper.safeTransferNative(royaltyReceiver, royaltyFraction);
		}
		emit Bought(_msgSender(), _tokenId);
	}

	/**
	 *  @notice Handle transfer token
	 *
	 *  @dev    Private function
	 *
	 *          Name            Meaning
	 *  @param  _from           Sender address
	 *  @param  _to             Recipient address
	 *  @param  _paymentToken   Payment token address (Zero address if transfer native token)
	 *  @param  _amount         Amount of token that want to transfer
	 */
	function _handleTransfer(
		address _from,
		address _to,
		address _paymentToken,
		uint256 _amount
	) private {
		if (_paymentToken == address(0)) {
			require(_amount <= address(this).balance, "Invalid amount");
			Helper.safeTransferNative(_to, _amount);
		} else {
			IERC20Upgradeable(_paymentToken).safeTransferFrom(
				_from,
				_to,
				_amount
			);
		}
	}

	function _setTokenStates(TokenInfo memory _tokenInput) private {}
}
