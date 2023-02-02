import { MintParamsStruct } from "./../../typechain-types/contracts/ERC721";
import { BigNumber, Contract } from "ethers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { AddressZero } from "@ethersproject/constants";
import { TokenType } from "./constant";

const ZERO_ADDRESS = AddressZero;

const getSignatureMint = async (
  contract: Contract,
  params: MintParamsStruct,
  signer: SignerWithAddress
): Promise<string> => {
  try {
    const hash = await contract.getMessageHashMint(
      params.to,
      params.owner,
      params.paymentToken,
      params.royaltyReceiver,
      params.price,
      params.amount,
      params.expiration,
      params.royaltyPercent,
      params.tokenURI,
      params.typeToken
    );
    const signature = await signer.signMessage(ethers.utils.arrayify(hash));
    return signature;
  } catch (error: any) {
    throw Error(error);
  }
};

const getSignatureSetTokenURI = async (
  contract: Contract,
  tokenId: BigNumber,
  tokenURI: string,
  signer: SignerWithAddress
): Promise<string> => {
  try {
    const hash = await contract.getMessageHashSetTokenURI(tokenId, tokenURI);
    const signature = await signer.signMessage(ethers.utils.arrayify(hash));
    return signature;
  } catch (error: any) {
    throw Error(error);
  }
};

const getSignatureSetType = async (
  contract: Contract,
  tokenId: BigNumber,
  type: TokenType,
  signer: SignerWithAddress
): Promise<string> => {
  try {
    const hash = await contract.getMessageHashSetType(tokenId, type);
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
  params: MintParamsStruct,
  verifier: SignerWithAddress
): Promise<void> => {
  try {
    const signature = await getSignatureMint(contract, params, verifier);

    params.paymentToken === ZERO_ADDRESS
      ? await contract.connect(caller).mint(to, params, signature, {
          value: params.amount,
        })
      : await contract.connect(caller).mint(to, params, signature);
  } catch (error: any) {
    throw Error(error);
  }
};

export {
  getSignatureMint,
  getSignatureSetTokenURI,
  getSignatureSetType,
  mintToken,
};
