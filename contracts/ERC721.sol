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
    string public baseURI;

    using CountersUpgradeable for CountersUpgradeable.Counter;
    CountersUpgradeable.Counter public lastId;

    /**
     * @dev Store token URI by token ID
     */
    mapping(uint256 => string) public _tokenURIs;

    /**
     * @dev Store history of transfer token: sender, receiver, tokenId
     */
    mapping(address => mapping(address => uint256)) private history;

    // @dev Emit event when contract is deployed
    event Deployed(
        address indexed owner,
        string tokenName,
        string symbol,
        string baseUri
    );

    // @dev Emit event when updating metadata of a token
    event SetBaseURI(string indexed oldUri, string indexed newUri);

    // @dev Emit event when transfering token
    event Transfered(
        address indexed from,
        address indexed to,
        uint256 indexed tokenId
    );

    // @dev Emit event when minting a token to an address
    event Minted(address indexed to, uint256 indexed tokenId);

    /**
     * @notice Setting states initial when deploying contract and only called once
     * @param _owner Contract owner address
     * @param _tokenName Token name
     * @param _symbol Token symbol
     * @param _baseURI Base URI metadata
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
     * @dev Update new base URI
     * @notice Only owner can call this function
     * @param _newURI New base URI metadata
     */
    function setBaseURI(string memory _newURI) external onlyOwnerOrController {
        string memory oldURI = baseURI;
        baseURI = _newURI;
        emit SetBaseURI(oldURI, _newURI);
    }

    /**
     * @dev Mint a token to an address
     * @notice Only owner can call this function
     * @param _to Address that want to mint a token
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
     * @dev Get base64 string from token ID to represent the token metadata
     * @param _tokenId Token ID
     * @return string base64
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

    function transfer(address _from, address _to, uint256 _tokenId) external {
        require(_from != address(0) && _to != address(0), "Invalid address");
        safeTransferFrom(_from, _to, _tokenId);
        history[_from][_to] = _tokenId;
        emit Transfered(_from, _to, _tokenId);
    }

    function getHistoryTransfer(
        address _from,
        address _to
    ) external view returns (uint256) {
        require(_from != address(0) && _to != address(0), "Invalid address");
        return history[_from][_to];
    }
}
