// SPDX-License-Identifier: MIT
pragma solidity 0.8.17;

import "@openzeppelin/contracts-upgradeable/token/ERC721/ERC721Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC721/extensions/ERC721EnumerableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/common/ERC2981Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/StringsUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/CountersUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import "./libraries/Helper.sol";
import "./Authorizable.sol";
import "./interfaces/IERC721.sol";
import "./interfaces/IERC20.sol";
import "./VerifySignature.sol";
import "hardhat/console.sol";

contract ERC721 is
    ERC721Upgradeable,
    ERC2981Upgradeable,
    Authorizable,
    VerifySignature,
    ReentrancyGuardUpgradeable
{
    using StringsUpgradeable for uint256;

    using CountersUpgradeable for CountersUpgradeable.Counter;

    CountersUpgradeable.Counter public lastId;

    RoyaltyInfo public defaultRoyaltyInfo;

    /**
     * @notice expiration uint256 is expired period of token
     */
    uint256 public expiration;

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
     * @notice Mapping token ID and URI to store token URIs
     */
    mapping(uint256 => string) private _tokenURIs;

    /**
     * @notice Emit event when contract is deployed
     */
    event Deployed(address indexed owner, string tokenName, string symbol);

    /**
     * @notice Emit event when updating metadata of a token
     */
    event SetBaseURI(string indexed oldUri, string indexed newUri);

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
     * @notice Emit event when owner calls withdraw function
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
        address _royaltyFeeReceiver,
        uint96 _royaltyPercentage
    ) public initializer {
        ReentrancyGuardUpgradeable.__ReentrancyGuard_init();
        __ERC721_init(_tokenName, _symbol);
        __Ownable_init();
        transferOwnership(_owner);

        expiration = _expiration;

        if (_royaltyFeeReceiver != address(0)) {
            require(_royaltyPercentage > 0, "Invalid royalty percentage");
            defaultRoyaltyInfo = RoyaltyInfo(
                _royaltyFeeReceiver,
                _royaltyPercentage
            );
            _setDefaultRoyalty(_royaltyFeeReceiver, _royaltyPercentage);
        }
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
        override(ERC721Upgradeable, ERC2981Upgradeable)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
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
    ) public {
        require(
            _exists(_tokenId),
            "ERC721Metadata: URI set of nonexistent token"
        );
        TokenInput memory _tokenInput = TokenInput(
            _tokenId,
            0,
            0,
            address(0),
            _tokenURI,
            true
        );
        require(
            verify(verifier, _tokenInput, _signature),
            "SetTokenURI: Invalid signature"
        );
        string memory oldTokenURI = _tokenURIs[_tokenId];
        _tokenURIs[_tokenId] = _tokenURI;
        emit SetTokenURI(_tokenId, oldTokenURI, _tokenURI);
    }

    /**
     *  @notice Set token URI of a token
     *
     *  @dev    Called after minting a token
     *
     *          Name        Meaning
     *  @param  _tokenInput    Token ID that want to set
     *  @param  _signature   New token URI that want to set
     *
     *  Emit event {SetTokenURI}
     */
    function _setTokenURI(
        TokenInput memory _tokenInput,
        bytes memory _signature
    ) private {
        require(
            verify(verifier, _tokenInput, _signature),
            "SetTokenURI: Invalid signature"
        );
        string memory oldTokenURI = _tokenURIs[_tokenInput.tokenId];
        _tokenURIs[_tokenInput.tokenId] = _tokenInput.tokenURI;
        emit SetTokenURI(
            _tokenInput.tokenId,
            oldTokenURI,
            _tokenInput.tokenURI
        );
    }

    /**
     *  @notice Set status of token by token ID
     *
     *          Name        Meaning
     *  @param  _tokenId    Token ID that want to set
     *  @param  _status     New status of token that want to set (true is ACTIVE, false is DEACTIVE)
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
        TokenInput memory _tokenInput = TokenInput(
            _tokenId,
            0,
            0,
            address(0),
            "",
            _status
        );
        require(
            verify(verifier, _tokenInput, _signature),
            "SetTokenStatus: Invalid signature"
        );
        emit SetTokenStatus(_tokenId, _status);
    }

    /**
     *  @notice Set token URI of a token
     *
     *  @dev    Called after minting a token
     *
     *          Name        Meaning
     *  @param  _tokenInput    Token ID that want to set
     *  @param  _signature   New token URI that want to set
     *
     *  Emit event {SetTokenURI}
     */
    function _setTokenStatus(
        TokenInput memory _tokenInput,
        bytes memory _signature
    ) private {
        require(
            verify(verifier, _tokenInput, _signature),
            "SetTokenStatus: Invalid signature"
        );
        require(
            statusOf[_tokenInput.tokenId] != _tokenInput.status,
            "Duplicate value"
        );
        statusOf[_tokenInput.tokenId] = _tokenInput.status;
        emit SetTokenStatus(_tokenInput.tokenId, _tokenInput.status);
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
        return _tokenURIs[_tokenId];
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
     *  @param  _tokenInput.tokenURI        Token URI (default "")
     *  @param  _tokenInput.status          Status of token (true is ACTIVE, false is DEACTIVE)
     *  @param  _signature                  Signature of transaction
     *
     *  Emit event {Transfer(address(0), _to, tokenId)}
     */
    function mint(
        address _to,
        TokenInput memory _tokenInput,
        bytes memory _signature
    ) public payable nonReentrant {
        require(_to != address(0), "Invalid address");
        require(
            _tokenInput.amount > 0 && _tokenInput.price > 0,
            "Invalid amount of money"
        );
        require(_tokenInput.amount >= _tokenInput.price, "Not enough money");
        if (_tokenInput.paymentToken == address(0)) {
            require(msg.value == _tokenInput.amount, "Invalid amount of money");
        }
        require(
            verify(verifier, _tokenInput, _signature),
            "Mint: Invalid signature"
        );
        lastId.increment();
        _safeMint(_to, lastId.current());
        // _setTokenURI(_tokenInput, _signature);
        _tokenURIs[_tokenInput.tokenId] = _tokenInput.tokenURI;
        // _setTokenStatus(_tokenInput, _signature);
        statusOf[lastId.current()] = true;
        expirationOf[lastId.current()] = block.timestamp + expiration;
        ownerBalanceOf[_tokenInput.paymentToken][_to] += _tokenInput.amount;
        if (_tokenInput.paymentToken != address(0)) {
            handleTransfer(
                _msgSender(),
                address(this),
                _tokenInput.paymentToken,
                _tokenInput.amount
            );
        }
    }

    /**
     *  @notice Withdraw
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
        handleTransfer(_msgSender(), _to, _paymentToken, _amount);
        emit Withdrawn(_paymentToken, _to, _amount);
    }

    /**
     *  @notice Claim
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
        require(
            ownerBalanceOf[_paymentToken][_to] <= _amount,
            "Invalid amount"
        );
        ownerBalanceOf[_paymentToken][_to] -= _amount;
        handleTransfer(address(this), _to, _paymentToken, _amount);
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
        require(_to != address(0), "Invalid address");
        require(statusOf[_tokenId], "Token is deactive");
        expirationOf[_tokenId] = block.timestamp + expiration;
        safeTransferFrom(_msgSender(), _to, _tokenId);
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
    function handleTransfer(
        address _from,
        address _to,
        address _paymentToken,
        uint256 _amount
    ) private {
        console.log("alo");
        if (_paymentToken == address(0)) {
            require(_amount <= address(this).balance, "Invalid amount");
            Helper.safeTransferNative(_to, msg.value);
        } else {
            uint256 balance = IERC20(_paymentToken).balanceOf(_from);
            require(_amount <= balance, "Invalid amount");
            IERC20(_paymentToken).transferFrom(_from, _to, _amount);
        }
    }
}
