import { TokenDetailStruct } from "./../../typechain-types/contracts/ERC721";
import { Contract } from "ethers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { AddressZero } from "@ethersproject/constants";

const ZERO_ADDRESS = AddressZero;

const getSignature = async (
  contract: Contract,
  tokenInput: TokenDetailStruct,
  signer: SignerWithAddress
): Promise<string> => {
  try {
    const hash = await contract.getMessageHash(
      tokenInput.tokenId,
      tokenInput.tokenURI,
      tokenInput.paymentToken,
      tokenInput.price,
      tokenInput.amount,
      tokenInput.owner,
      tokenInput.status
    );
    const signature = await signer.signMessage(ethers.utils.arrayify(hash));
    return signature;
  } catch (error: any) {
    throw Error(error);
  }
};

const mintToken = async (
  contract: Contract,
  caller: SignerWithAddress,
  to: string,
  tokenInput: TokenDetailStruct,
  verifier: SignerWithAddress
): Promise<void> => {
  try {
    const signature = await getSignature(contract, tokenInput, verifier);

    tokenInput.paymentToken === ZERO_ADDRESS
      ? await contract.connect(caller).mint(to, tokenInput, signature, {
          value: tokenInput.amount,
        })
      : await contract.connect(caller).mint(to, tokenInput, signature);
  } catch (error: any) {
    throw Error(error);
  }
};

const mintRoyaltyToken = async (
  contract: Contract,
  caller: SignerWithAddress,
  to: string,
  tokenInput: TokenDetailStruct,
  royaltyReceiver: string,
  verifier: SignerWithAddress
): Promise<void> => {
  try {
    const signature = await getSignature(contract, tokenInput, verifier);

    tokenInput.paymentToken === ZERO_ADDRESS
      ? await contract
          .connect(caller)
          .mintWithRoyalty(to, tokenInput, signature, royaltyReceiver, {
            value: tokenInput.amount,
          })
      : await contract
          .connect(caller)
          .mintWithRoyalty(to, tokenInput, signature, royaltyReceiver);
  } catch (error: any) {
    throw Error(error);
  }
};

export { getSignature, mintToken, mintRoyaltyToken };
