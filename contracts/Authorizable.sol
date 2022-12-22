//SPDX-License-Identifier: MIT
pragma solidity 0.8.17;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "./interfaces/IAuthorizable.sol";

abstract contract Authorizable is IAuthorizable, OwnableUpgradeable {
    /**
     * @notice Mapping address and boolean to store controller right of an address
     */
    mapping(address => bool) private _controller;

    /**
     * @notice Emit event when set an address to a controller
     */
    event SetController(address indexed account, bool isAllow);

    modifier onlyOwnerOrController() {
        require(
            _msgSender() == owner() || _controller[_msgSender()],
            "Ownable: Caller is not owner/controller"
        );
        _;
    }

    /**
     * @notice Set address to controller
     * @param _account Account address that want to set
     *
     * Emit event {SetController}
     */
    function setController(
        address _account,
        bool _isAllow
    ) external onlyOwnerOrController {
        require(_account != address(0), "Ownable: Invalid address");
        require(_controller[_account] != _isAllow, "Ownable: Duplicate value");
        _controller[_account] = _isAllow;
        emit SetController(_account, _isAllow);
    }

    /**
     * @notice Check an address is an owner or a controller of contract
     *
     *          Name        Meaning
     * @param   _account    Account address that want to check
     *
     *          Type        Meaning
     *  @return address     Contract owner address
     */
    function isOwnerOrController(
        address _account
    ) external view returns (bool) {
        require(_account != address(0), "Ownable: Invalid address");
        return _controller[_account] || _account == owner();
    }
}
