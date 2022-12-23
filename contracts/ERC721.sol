// SPDX-License-Identifier: MIT
pragma solidity 0.8.17;

import "@openzeppelin/contracts-upgradeable/token/ERC721/extensions/ERC721EnumerableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/StringsUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/CountersUpgradeable.sol";
import "./interfaces/IERC721.sol";
import "./Authorizable.sol";

contract ERC721 is ERC721EnumerableUpgradeable, Authorizable {
    using StringsUpgradeable for uint256;

    /**
     * @notice baseURI string is base URI of token
     */
    string public baseURI;

    using CountersUpgradeable for CountersUpgradeable.Counter;

    CountersUpgradeable.Counter public lastTokenId;
    CountersUpgradeable.Counter public lastHistoryId;

    /**
     * @notice Mapping history ID and URI to store history transfer
     */
    mapping(uint256 => History) private _history;

    /**
     * @notice Mapping token ID and URI to store token URIs
     */
    mapping(uint256 => string) private _tokenURIs;

    /**
     * @notice Mapping token ID and boolean to store token is transfered or not
     */
    mapping(uint256 => bool) public transfered;

    /**
     * @dev Store merkle tree from token ID
     */
    // mapping(uint256 => bytes32) public merkleRoots;

    /**
     * @notice Emit event when contract is deployed
     */
    event Deployed(
        address indexed owner,
        string tokenName,
        string symbol,
        string baseUri
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
     * @notice Emit event when transfering token
     */
    event Transfered(
        uint256 indexed historyId,
        address from,
        address to,
        uint256 indexed tokenId
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
     *  @param  _baseUri    Base URI metadata
     *
     *  Emit event {Deployed}
     */
    function initialize(
        address _owner,
        string memory _tokenName,
        string memory _symbol,
        string memory _baseUri
    ) public initializer {
        __ERC721_init(_tokenName, _symbol);
        __Ownable_init();
        transferOwnership(_owner);

        baseURI = _baseUri;

        emit Deployed(_owner, _tokenName, _symbol, _baseUri);
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
    function setBaseURI(string memory _newURI) external onlyOwnerOrController {
        require(
            keccak256(abi.encodePacked((_newURI))) !=
                keccak256(abi.encodePacked((baseURI))),
            "Duplicate base URI"
        );
        string memory oldURI = baseURI;
        baseURI = _newURI;
        emit SetBaseURI(oldURI, _newURI);
    }

    /**
     *  @notice Set token URI by token ID
     *
     *  @dev    Only owner or controller can call this function
     *
     *          Name        Meaning
     *  @param  _tokenId    Token ID that want to set
     *  @param  _tokenURI   New token URI that want to set
     *
     *  Emit event {SetTokenURI}
     */
    function setTokenURI(
        uint256 _tokenId,
        string memory _tokenURI
    ) external onlyOwnerOrController {
        require(
            _exists(_tokenId),
            "ERC721Metadata: URI set of nonexistent token"
        );
        require(!transfered[_tokenId], "Token is transfered");
        string memory oldTokenURI = _tokenURIs[_tokenId];
        _tokenURIs[_tokenId] = _tokenURI;
        emit SetTokenURI(_tokenId, oldTokenURI, _tokenURI);
    }

    /**
     *  @notice Get token URI by token ID
     *
     *  @dev    Only owner or controller can call this function
     *
     *          Name        Meaning
     *  @param  _tokenId    Token ID that want to set
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
     *  @notice Mint a token to an address
     *
     *  @dev    Only owner or controller can call this function
     *
     *          Name        Meaning
     *  @param  _to         Address that want to mint token\
     *
     *                      Type        Meaning
     *  @return tokenId     uint256     New token ID
     *
     *  Emit event {Transfer(address(0), _to, tokenId)}
     */
    function mint(
        address _to
    ) external onlyOwnerOrController returns (uint256 tokenId) {
        lastTokenId.increment();
        _safeMint(_to, lastTokenId.current());
        tokenId = lastTokenId.current();
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
     *  Emit event {Transfered}
     */
    function transfer(address _to, uint256 _tokenId) external {
        require(_to != address(0), "Invalid address");
        safeTransferFrom(_msgSender(), _to, _tokenId);
        lastHistoryId.increment();
        transfered[_tokenId] = true;
        _history[lastHistoryId.current()] = History(
            lastHistoryId.current(),
            _tokenId,
            _msgSender(),
            _to
        );
        emit Transfered(lastHistoryId.current(), _msgSender(), _to, _tokenId);
    }

    /**
     *  @notice Get history transfer of sender and recipient addresses
     *
     *  @dev    Anyone can call this function
     *
     *          Name        Meaning
     *  @param  _historyId  History transfer ID
     *
     *          Type        Meaning
     *  @return History     History transfer detail
     */
    function getHistoryTransfer(
        uint256 _historyId
    ) external view returns (History memory) {
        require(
            _historyId > 0 && _historyId <= lastHistoryId.current(),
            "Invalid history ID"
        );
        return _history[_historyId];
    }
}
