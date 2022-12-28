// SPDX-License-Identifier: MIT
pragma solidity 0.8.17;

import "@openzeppelin/contracts-upgradeable/token/ERC721/extensions/IERC721MetadataUpgradeable.sol";

interface IERC721 is IERC721MetadataUpgradeable {
    function mint(address _to) external returns (uint256);

    function setBaseURI(string memory baseUri) external;

    function setExpiration(uint256 _expiration) external;

    function setTokenURI(uint256 tokenId, string memory _tokenURI) external;

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

    function transfer(address _from, address _to, uint256 tokenId) external;
}

struct TokenInput {
    uint256 tokenId;
    uint256 amount; // Amount of money that user pay
    uint256 price; // Amount of money that need to mint
    address paymentToken; // Zero address when paying native token
    string tokenURI;
    bool status; // true is ACTIVE, false is DEACTIVE
}
