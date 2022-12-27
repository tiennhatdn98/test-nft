import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { ZERO_ADDRESS } from "@openzeppelin/test-helpers/src/constants";
import { expect } from "chai";
import { BigNumber, Contract } from "ethers";
import { ethers } from "hardhat";
import { TokenInputStruct } from "../typechain-types/contracts/ERC721";

describe("VerifySignature", () => {
  let verifySignature: Contract;
  let signer: SignerWithAddress;
  let tokenId: BigNumber;
  let tokenURI: string;
  let tokenStatus: boolean;
  let paymentToken = ZERO_ADDRESS;
  let amount: BigNumber;

  beforeEach(async () => {
    const VerifySignature = await ethers.getContractFactory("VerifySignature");
    verifySignature = await VerifySignature.deploy();
    await verifySignature.deployed();
  });

  it("Check signature", async () => {
    const [_signer, ..._users] = await ethers.getSigners();
    signer = _signer;
    tokenId = BigNumber.from(1);
    tokenURI = "ipfs://1.json";
    amount = BigNumber.from(999);

    let tokenInput1: TokenInputStruct = {
      tokenId,
      tokenURI,
      status: tokenStatus,
      paymentToken,
      amount,
    };

    let tokenInput2: TokenInputStruct = {
      tokenId,
      tokenURI,
      status: tokenStatus,
      paymentToken,
      amount: amount.add(1),
    };

    const hash = await verifySignature.getMessageHash(
      tokenId,
      tokenURI,
      tokenStatus,
      paymentToken,
      amount
    );
    const sig = await signer.signMessage(ethers.utils.arrayify(hash));
    const ethHash = await verifySignature.getEthSignedMessageHash(hash);

    console.log("Signer:         ", signer.address);
    console.log(
      "Recover signer: ",
      await verifySignature.recoverSigner(ethHash, sig)
    );

    expect(
      await verifySignature.verify(signer.address, tokenInput1, sig)
    ).to.be.equal(true);

    expect(
      await verifySignature.verify(signer.address, tokenInput2, sig)
    ).to.be.equal(false);
  });
});
