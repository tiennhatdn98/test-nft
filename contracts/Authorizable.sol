//SPDX-License-Identifier: MIT
pragma solidity 0.8.17;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";

abstract contract Authorizable is OwnableUpgradeable {
    mapping(address => bool) private _controller;

    event SetController(address indexed account);
    event RemovedController(address indexed account);

    modifier onlyOwnerOrController() {
        require(
            _msgSender() == owner() || _controller[_msgSender()],
            "Ownable: Caller is not owner/controller"
        );
        _;
    }

    function setController(address _account) external onlyOwnerOrController {
        require(_account != address(0), "Ownable: Invalid address");

        _controller[_account] = true;
        emit SetController(_account);
    }

    function removeController(address _account) external onlyOwnerOrController {
        require(_account != address(0), "Ownable: Invalid address");
        require(
            _controller[_account],
            "Ownable: Given address is not a controller"
        );

        _controller[_account] = false;
        emit RemovedController(_account);
    }
}
