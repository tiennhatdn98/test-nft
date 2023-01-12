// SPDX-License-Identifier: MIT
pragma solidity 0.8.16;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @title ERC20 token as stable coin
/// @notice This is use for development testing on local private chain only
/// @notice For public chain deployment, need to use a ready deployed address
contract CashTestToken is ERC20 {
	uint8 private _decimals;

	constructor(
		string memory _name,
		string memory _symbol,
		uint8 decimals_
	) ERC20(_name, _symbol) {
		_decimals = decimals_;
	}

	function decimals() public view override returns (uint8) {
		return _decimals;
	}

	/// @dev generate tokens and distributes to testing account
	function mintFor(address _acc, uint256 _amount) external {
		_mint(_acc, _amount);
	}

	/// @dev generate tokens and distributes to list of testing account
	// function mintForList(address[] memory _accs, uint256 _amount) external {
	// 	require(_accs.length > 0, "Invalid minted accounts");
	// 	require(_amount > 0, "Invalid minted amount");

	// 	uint256 mintedAmount = _amount;
	// 	for (uint256 i = 0; i < _accs.length; i++) {
	// 		_mint(_accs[i], mintedAmount);
	// 	}
	// }
}
