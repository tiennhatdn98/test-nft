import { AddressZero, MaxUint256 } from "@ethersproject/constants";

export enum TokenType {
  Normal,
  Furusato,
}

export const ZERO_ADDRESS = AddressZero;
export const MAX_UINT256 = MaxUint256;
export const TOKEN_NAME = "Token";
export const SYMBOL = "TKN";
export const DECIMALS = 6;
export const YEAR_TO_SECONDS = 31_556_926;
export const NONEXISTENT_TOKEN_ID = 9999;
export const ROYALTY_PERCENTAGE = 10;
