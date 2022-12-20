// SPDX-License-Identifier: MIT
pragma solidity 0.8.17;

import "@openzeppelin/contracts-upgradeable/token/ERC721/IERC721Upgradeable.sol";

interface IERC721 is IERC721Upgradeable {
    function mint(address _to) external returns (uint256);

    function setBaseURI(string memory baseUri) external;

    function transfer(address _from, address _to, uint256 tokenId) external;

    function getHistoryTransfer(
        address _from,
        address _to
    ) external view returns (uint256);
}
