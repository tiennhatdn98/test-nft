// SPDX-License-Identifier: MIT
pragma solidity 0.8.17;

import "@openzeppelin/contracts-upgradeable/token/ERC721/ERC721Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/StringsUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/CountersUpgradeable.sol";
import "./libraries/Helper.sol";
import "./Authorizable.sol";
import "./interfaces/IERC721.sol";
import "./interfaces/IERC20.sol";
import "./VerifySignature.sol";

contract ERC721 is ERC721Upgradeable, Authorizable, VerifySignature {
    using StringsUpgradeable for uint256;

    /**
     * @notice baseURI string is base URI of token
     */
    // string public baseURI;

    using CountersUpgradeable for CountersUpgradeable.Counter;

    CountersUpgradeable.Counter public lastId;

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
    event Deployed(
        address indexed owner,
        string tokenName,
        string symbol
        // string baseUri
    );

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
        // string memory _baseUri,
        uint256 _expiration
    ) public initializer {
        __ERC721_init(_tokenName, _symbol);
        __Ownable_init();
        transferOwnership(_owner);
        // baseURI = _baseUri;
        expiration = _expiration;
        emit Deployed(_owner, _tokenName, _symbol);
    }

    /**
     *  @notice Update new base URI
     *
     *  @dev    Only owner or controller can call this function
     *
     *          Name        Meaning
     *  @param  _newURI     New URI that want to set
     *
     *  Emit event {SetBaseURI}
     */
    // function setBaseURI(string memory _newURI) external onlyAdmin {
    //     require(
    //         keccak256(abi.encodePacked((_newURI))) !=
    //             keccak256(abi.encodePacked((baseURI))),
    //         "Duplicate base URI"
    //     );
    //     string memory oldURI = baseURI;
    //     baseURI = _newURI;
    //     emit SetBaseURI(oldURI, _newURI);
    // }

    /**
     *  @notice Set token URI by token ID
     *
     *          Name        Meaning
     *  @param  _tokenId    Token ID that want to set
     *  @param  _tokenURI   New token URI that want to set
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
            _tokenURI,
            false,
            address(0),
            0
        );
        require(verify(verifier, _tokenInput, _signature), "Invalid signature");
        string memory oldTokenURI = _tokenURIs[_tokenId];
        _tokenURIs[_tokenId] = _tokenURI;
        emit SetTokenURI(_tokenId, oldTokenURI, _tokenURI);
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
        TokenInput memory _tokenInput = TokenInput(
            _tokenId,
            "",
            _status,
            address(0),
            0
        );
        require(verify(verifier, _tokenInput, _signature), "Invalid signature");
        require(statusOf[_tokenId] != _status, "Duplicate value");
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
        expiration = _expiration;
    }

    /**
     *  @notice Mint a token to an address
     *
     *  @dev    Only owner or controller can call this function
     *
     *          Name            Meaning
     *  @param  _to             Address that want to mint token
     *  @param  _tokenInput     Parameters that want to set
     *  @param  _signature      Signature
     *
     *  Emit event {Transfer(address(0), _to, tokenId)}
     */
    function mint(
        address _to,
        TokenInput memory _tokenInput,
        bytes memory _signature
    ) external {
        require(_to != address(0), "Invalid address");
        require(_tokenInput.amount > 0, "Invalid amount");
        require(verify(verifier, _tokenInput, _signature), "Invalid signature");
        lastId.increment();
        _safeMint(_to, lastId.current());
        setTokenURI(lastId.current(), _tokenInput.tokenURI, _signature);
        setTokenStatus(lastId.current(), true, _signature);
        expirationOf[lastId.current()] = block.timestamp + expiration;
        ownerBalanceOf[_tokenInput.paymentToken][_msgSender()] += _tokenInput
            .amount;
        statusOf[lastId.current()] = true;
        handleTransfer(
            _msgSender(),
            _to,
            _tokenInput.paymentToken,
            _tokenInput.amount
        );
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
    ) external onlyOwner {
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
    ) external {
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
        require(_to != address(0), "Invalid address");
        require(_amount != 0, "Invalid amount");
        if (_paymentToken == address(0)) {
            require(_amount <= address(this).balance, "Invalid amount");
            Helper.safeTransferNative(_to, _amount);
        } else {
            uint256 balance = IERC20(_paymentToken).balanceOf(_from);
            require(_amount <= balance, "Invalid amount");
            IERC20(_paymentToken).transferFrom(_from, _to, _amount);
        }
    }
}
