//SPDX-License-Identifier: MIT
pragma solidity 0.8.17;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/AddressUpgradeable.sol";

import "./interfaces/IAuthorizable.sol";

abstract contract Authorizable is IAuthorizable, OwnableUpgradeable {
	using AddressUpgradeable for address;
	/**
	 * @notice admin address is Admin address
	 */
	address public admin;

	/**
	 * @notice verifier address is Verifier address
	 */
	address public verifier;

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

	/**
	 * @notice Set address to an admin
	 * @param _account New amin address that want to set
	 *
	 * Emit event {SetAdmin}
	 */
	function setAdmin(address _account) external onlyOwner {
		require(
			_account != address(0) && !_account.isContract(),
			"Ownable: Invalid address"
		);
		address oldAdmin = admin;
		admin = _account;
		emit SetAdmin(oldAdmin, admin);
	}

	/**
	 * @notice Set address to a verifier
	 * @param _account New verifier address that want to set
	 *
	 * Emit event {SetVerifier}
	 */
	function setVerifier(address _account) external onlyAdmin {
		require(
			_account != address(0) && !_account.isContract(),
			"Ownable: Invalid address"
		);
		address oldVerifier = verifier;
		verifier = _account;
		emit SetVerifier(oldVerifier, verifier);
	}
}
