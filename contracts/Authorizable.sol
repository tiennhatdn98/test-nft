//SPDX-License-Identifier: MIT
pragma solidity 0.8.17;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "./interfaces/IAuthorizable.sol";

abstract contract Authorizable is IAuthorizable, OwnableUpgradeable {
    /**
     * @notice admin address is Admin address
     */
    address admin;

    /**
     * @notice verifier address is Verifier address
     */
    address verifier;

    /**
     * @notice Emit event when set an address to a admin
     */
    event SetAdmin(address indexed oldAdmin, address indexed newAdmin);

    /**
     * @notice Emit event when set an address to a verififer
     */
    event SetVerifier(address indexed oldVerifier, address indexed newVerifier);

    modifier onlyAdmin() {
        require(_msgSender() == admin, "Ownable: Caller is not admin");
        _;
    }

    modifier onlyOwnerOrAdmin() {
        require(
            _msgSender() == admin || _msgSender() == owner(),
            "Ownable: Caller is not owner or admin"
        );
        _;
    }

    /**
     * @notice Set address to an admin
     * @param _account Account address that want to set
     *
     * Emit event {SetAdmin}
     */
    function setAdmin(address _account) external onlyOwner {
        require(_account != address(0), "Ownable: Invalid address");
        address oldAdmin = admin;
        admin = _account;
        emit SetAdmin(oldAdmin, admin);
    }

    /**
     * @notice Set address to a verifier
     * @param _account Account address that want to set
     *
     * Emit event {SetVerifier}
     */
    function setVerifier(address _account) external onlyAdmin {
        require(_account != address(0), "Ownable: Invalid address");
        address oldVerifier = verifier;
        verifier = _account;
        emit SetVerifier(oldVerifier, verifier);
    }
}
