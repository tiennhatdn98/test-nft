// SPDX-License-Identifier: MIT
pragma solidity 0.8.16;

import "@openzeppelin/contracts-upgradeable/token/ERC721/ERC721Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC721/extensions/ERC721EnumerableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/common/ERC2981Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/StringsUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/CountersUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/AddressUpgradeable.sol";
import "./Authorizable.sol";
import "./interfaces/IERC721.sol";
import "./VerifySignature.sol";

contract ERC721 is
	ERC721Upgradeable,
	ERC721EnumerableUpgradeable,
	ERC2981Upgradeable,
	Authorizable,
	VerifySignature,
	ReentrancyGuardUpgradeable
{
	using SafeERC20Upgradeable for IERC20Upgradeable;
	using StringsUpgradeable for uint256;
	using CountersUpgradeable for CountersUpgradeable.Counter;
	using AddressUpgradeable for address payable;
	using AddressUpgradeable for address;

	/**
	 * @notice Latest token ID
	 */
	CountersUpgradeable.Counter public lastId;

	/**
	 * @notice Mapping token ID => type of token
	 */
	mapping(uint256 => TokenType) public typeOf;

	/**
	 * @notice Mapping token ID => token payment
	 */
	mapping(uint256 => TokenPayment) private _tokenPayments;

	/**
	 * @notice Mapping token ID => token URI
	 */
	mapping(uint256 => string) private _tokenURIs;

	/**
	 * @notice Mapping signature => token ID
	 */
	mapping(bytes => uint256) public tokenIdOf;

	/**
	 * @notice Emit event when contract is deployed
	 */
	event Deployed(address owner, string tokenName, string symbol);

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
	event SetType(uint256 indexed tokenId, TokenType typeToken);

	/**
	 * @notice Emit event when owner withdraws
	 */
	event Withdrawn(
		address indexed paymentToken,
		address indexed to,
		uint256 amount
	);

	/**
	 * @notice Emit event when someone buy token
	 */
	event Bought(
		address indexed owner,
		address indexed buyer,
		uint256 indexed tokenId
	);

	/**
	 * @notice Emit event when donate a token
	 */
	event Donated(
		address indexed sender,
		address indexed receiver,
		uint256 indexed tokenId
	);

	/**
	 *  @notice Update new base URI
	 *
	 *  @dev    Setting states initial when deploy contract and only be called once
	 *
	 *          Name        					Meaning
	 *  @param  _owner      					Contract owner address
	 *  @param  _tokenName  					Token name
	 *  @param  _symbol     					Token symbol
	 *
	 *  Emit event {Deployed}
	 */
	function initialize(
		address _owner,
		string memory _tokenName,
		string memory _symbol
	) public initializer {
		ReentrancyGuardUpgradeable.__ReentrancyGuard_init();
		__ERC721_init(_tokenName, _symbol);
		__Ownable_init();
		transferOwnership(_owner);

		emit Deployed(_owner, _tokenName, _symbol);
	}

	/**
	 * @dev See {IERC165-supportsInterface}.
	 */
	function supportsInterface(
		bytes4 interfaceId
	)
		public
		view
		override(
			ERC721Upgradeable,
			ERC2981Upgradeable,
			ERC721EnumerableUpgradeable
		)
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
	function _beforeTokenTransfer(
		address from,
		address to,
		uint256 tokenId,
		uint256 batchSize
	) internal override(ERC721Upgradeable, ERC721EnumerableUpgradeable) {
		super._beforeTokenTransfer(from, to, tokenId, batchSize);
	}

	/**
	 *  @notice Check token input is valid or not
	 *
	 *  @dev    Private function
	 *
	 *          Name        	Meaning
	 *  @param  _to      			Recipient address
	 *  @param  _params  	Token input
	 *  @param  _signature    Signature of transaction
	 */
	function _checkValidParams(
		address _to,
		MintParams memory _params,
		bytes memory _signature
	) private view {
		require(_to != address(0) && !_to.isContract(), "Invalid address");
		require(bytes(_params.tokenURI).length > 0, "Empty URI");
		require(
			_params.owner != address(0) && !_params.owner.isContract(),
			"Invalid owner address"
		);
		if (_params.typeToken != TokenType.Furusato) {
			require(
				_params.amount > 0 &&
					_params.price > 0 &&
					_params.amount >= _params.price,
				"Invalid price or amount"
			);
			if (_params.paymentToken == address(0)) {
				require(msg.value == _params.amount, "Invalid price or amount");
			} else {
				require(
					_params.paymentToken.isContract(),
					"Invalid token address"
				);
			}
		}
		require(verifyMint(verifier, _params, _signature), "Invalid signature");
	}

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
	) external {
		require(_exists(_tokenId), "Nonexistent token");
		require(bytes(_tokenURI).length > 0, "Empty URI");
		require(
			verifySetTokenURI(verifier, _tokenId, _tokenURI, _signature),
			"Invalid signature"
		);
		string memory oldTokenURI = _tokenURIs[_tokenId];
		_tokenURIs[_tokenId] = _tokenURI;
		emit SetTokenURI(_tokenId, oldTokenURI, _tokenURI);
	}

	/**
	 *  @notice Set type of token by token ID
	 *
	 *          Name        Meaning
	 *  @param  _tokenId    Token ID that want to set
	 *  @param  _type     New status of token that want to set (true is ACTIVE, false is DEACTIVE)
	 *  @param  _signature  Signature of transaction
	 *
	 *  Emit event {SetTokenStatus}
	 */
	function setType(
		uint256 _tokenId,
		TokenType _type,
		bytes memory _signature
	) external {
		require(_exists(_tokenId), "Nonexistent token");
		require(typeOf[_tokenId] != _type, "Duplicate value");
		require(
			verifySetType(verifier, _tokenId, _type, _signature),
			"Invalid signature"
		);
		typeOf[_tokenId] = _type;
		emit SetType(_tokenId, _type);
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
		require(_exists(_tokenId), "Nonexistent token.");
		return _tokenURIs[_tokenId];
	}

	/**
	 *  @notice Mint a token to an address
	 *
	 *  @dev    Only owner or controller can call this function
	 *
	 *          Name                        Meaning
	 *  @param  _to                        	Recipient address
	 *  @param  _params.to         					Recipient address
	 *  @param  _params.owner        				Local government address
	 *  @param  _params.royaltyReceiver     Royalty receiver address
	 *  @param  _params.paymentToken    		Payment token address (Zero address if user pay native token)
	 *  @param  _params.price           		Amount of money that need to mint token
	 *  @param  _params.amount          		Amount of money that user pays
	 *  @param  _params.expiration        	Expired years of token
	 *  @param  _params.royaltyPercent      Royalty percent
	 *  @param  _params.tokenURI        		Token URI
	 *  @param  _params.typeToken         	Type of token
	 *  @param  _signature                  Signature of transaction
	 *
	 *  Emit event {Transfer(address(0), _to, tokenId)}
	 */
	function mint(
		address _to,
		MintParams calldata _params,
		bytes calldata _signature
	) external payable nonReentrant {
		_checkValidParams(_to, _params, _signature);
		_beforeMint(_params, _signature);
		_safeMint(_to, lastId.current());
		_setTokenRoyalty(
			lastId.current(),
			_params.royaltyReceiver,
			_params.royaltyPercent
		);
		_handleTransfer(
			_msgSender(),
			_params.owner,
			_params.paymentToken,
			_params.price
		);
		if (_params.paymentToken != address(0)) {
			_handleTransfer(
				_msgSender(),
				address(this),
				_params.paymentToken,
				_params.amount - _params.price
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
		require(_amount > 0, "Invalid amount");
		_paymentToken == address(0)
			? payable(_to).sendValue(_amount)
			: IERC20Upgradeable(_paymentToken).safeTransfer(_to, _amount);
		emit Withdrawn(_paymentToken, _to, _amount);
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
		require(_msgSender() != _to, "Transfer to yourself");
		require(_exists(_tokenId), "Nonexistent token.");
		require(typeOf[_tokenId] == TokenType.Normal, "Token is deactive");
		safeTransferFrom(_msgSender(), _to, _tokenId);
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
		require(_exists(_tokenId), "Nonexistent token.");
		require(ownerOf(_tokenId) != _msgSender(), "Already owned");
		require(typeOf[_tokenId] == TokenType.Normal, "Token is not normal");

		TokenPayment memory token = _tokenPayments[_tokenId];
		(address royaltyReceiver, uint256 royaltyFraction) = royaltyInfo(
			_tokenId,
			token.price
		);

		_handleTransfer(
			_msgSender(),
			ownerOf(_tokenId),
			token.paymentToken,
			token.price - royaltyFraction
		);
		_handleTransfer(
			_msgSender(),
			royaltyReceiver,
			token.paymentToken,
			royaltyFraction
		);
		_safeTransfer(ownerOf(_tokenId), _msgSender(), _tokenId, "");
		emit Bought(ownerOf(_tokenId), _msgSender(), _tokenId);
	}

	/**
	 *  @notice Donate a Furusato token
	 *
	 *  @dev    Anyone can call this function
	 *
	 *          Name            Meaning
	 *  @param  _tokenId        Token ID
	 *  @param  _to        			Recipient address
	 *
	 *  Emit event {Donated}
	 */
	function donate(uint256 _tokenId, address _to) external {
		require(_exists(_tokenId), "Nonexistent token");
		require(_msgSender() == ownerOf(_tokenId), "Not token owner");
		require(typeOf[_tokenId] == TokenType.Furusato, "Not Furusato token");
		safeTransferFrom(_msgSender(), _to, _tokenId);
		emit Donated(_msgSender(), _to, _tokenId);
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
		_paymentToken == address(0)
			? payable(_to).sendValue(_amount)
			: IERC20Upgradeable(_paymentToken).safeTransferFrom(
				_from,
				_to,
				_amount
			);
	}

	/**
	 *  @notice Update token states before minting
	 *
	 * 	@dev 		Private function
	 *
	 *          Name        	Meaning
	 *  @param  _params  			Token parameters
	 *  @param  _signature    Mint token caller
	 */
	function _beforeMint(
		MintParams calldata _params,
		bytes calldata _signature
	) private {
		lastId.increment();
		uint256 tokenId = lastId.current();
		typeOf[tokenId] = _params.typeToken;
		tokenIdOf[_signature] = tokenId;
		_tokenURIs[tokenId] = _params.tokenURI;
		_tokenPayments[tokenId] = TokenPayment({
			paymentToken: _params.paymentToken,
			price: _params.price
		});
	}
}
