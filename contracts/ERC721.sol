// SPDX-License-Identifier: MIT
pragma solidity 0.8.17;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC721/ERC721Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC721/extensions/ERC721EnumerableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/common/ERC2981Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/StringsUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/CountersUpgradeable.sol";
import "./interfaces/IERC721.sol";
import "./Authorizable.sol";

contract ERC721 is ERC721Upgradeable, Authorizable {
    using StringsUpgradeable for uint256;

    /**
     * @notice baseURI string is base URI of token
     */
    string public baseURI;

    using CountersUpgradeable for CountersUpgradeable.Counter;
    CountersUpgradeable.Counter public lastId;

    /**
     * @notice Mapping token ID and URI to store token URIs
     */
    mapping(uint256 => string) public _tokenURIs;

    /**
     * @notice Mapping sender address to recipient address to token ID to store history transfer
     */
    mapping(address => mapping(address => uint256)) private history;

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
        address indexed from,
        address indexed to,
        uint256 indexed tokenId
    );

    /**
     * @notice Emit event when minting a token to an address
     */
    event Minted(address indexed to, uint256 indexed tokenId);

    /**
     *  @notice Update new base URI
     *
     *  @dev    Only owner or controller can call this function
     *
     *          Name        Meaning
     *  @param  _owner      Contract owner address
     *  @param  _tokenName  Token name
     *  @param  _symbol     Token symbol
     *  @param  _baseURI    Base URI metadata
     *
     *  Emit event {Deployed}
     */
    function initialize(
        address _owner,
        string memory _tokenName,
        string memory _symbol,
        string memory _baseURI
    ) public initializer {
        __ERC721_init(_tokenName, _symbol);
        __Ownable_init();
        transferOwnership(_owner);

        baseURI = _baseURI;

        emit Deployed(_owner, _tokenName, _symbol, _baseURI);
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
        string memory oldTokenURI = _tokenURIs[_tokenId];
        _tokenURIs[_tokenId] = _tokenURI;
        emit SetTokenURI(_tokenId, oldTokenURI, _tokenURI);
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
     *  Emit event {Minted}
     */
    function mint(
        address _to
    ) external onlyOwnerOrController returns (uint256 tokenId) {
        lastId.increment();
        _safeMint(_to, lastId.current());
        tokenId = lastId.current();
        emit Minted(_to, tokenId);
    }

    /**
     *  @notice Get base64 string from token ID to represent the token metadata
     *
     *  @dev    Anyone can call this function
     *
     *          Name        Meaning
     *  @param  _tokenId    Token ID
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
        return
            bytes(baseURI).length > 0
                ? string(
                    abi.encodePacked(baseURI, _tokenId.toString(), ".json")
                )
                : ".json";
    }

    /**
     *  @notice Transfer token from an address to another address
     *
     *  @dev    Anyone can call this function
     *
     *          Name        Meaning
     *  @param  _from       Sender address
     *  @param  _to         Recipient address
     *  @param  _tokenId    Token ID
     *
     *  Emit event {Transfered}
     */
    function transfer(address _from, address _to, uint256 _tokenId) external {
        require(_from != address(0) && _to != address(0), "Invalid address");
        safeTransferFrom(_from, _to, _tokenId);
        history[_from][_to] = _tokenId;
        emit Transfered(_from, _to, _tokenId);
    }

    /**
     *  @notice Get history transfer of sender and recipient addresses
     *
     *  @dev    Anyone can call this function
     *
     *          Name        Meaning
     *  @param  _from       Sender address
     *  @param  _to         Recipient address
     *
     *          Type        Meaning
     *  @return uint256     Token ID
     */
    function getHistoryTransfer(
        address _from,
        address _to
    ) external view returns (uint256) {
        require(_from != address(0) && _to != address(0), "Invalid address");
        return history[_from][_to];
    }
}
