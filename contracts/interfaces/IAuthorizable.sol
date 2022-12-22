// SPDX-License-Identifier: MIT
pragma solidity 0.8.17;

interface IAuthorizable {
    function setController(address _account, bool _isAllow) external;

    function isOwnerOrController(address _account) external view returns (bool);
}
