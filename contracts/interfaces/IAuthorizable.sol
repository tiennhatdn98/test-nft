// SPDX-License-Identifier: MIT
pragma solidity 0.8.16;

interface IAuthorizable {
	function setAdmin(address _account) external;

	function setVerifier(address _account) external;
}
