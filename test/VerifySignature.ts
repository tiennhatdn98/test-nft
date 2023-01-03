import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { ZERO_ADDRESS } from "@openzeppelin/test-helpers/src/constants";
import { expect } from "chai";
import { Contract } from "ethers";
import { ethers } from "hardhat";
import { TokenInputStruct } from "../typechain-types/contracts/ERC721";

describe("VerifySignature", () => {
  let verifySignature: Contract;
  let signer: SignerWithAddress;

  beforeEach(async () => {
    const VerifySignature = await ethers.getContractFactory("VerifySignature");
    verifySignature = await VerifySignature.deploy();
    await verifySignature.deployed();
  });

  it("Check signature", async () => {
    const [_signer, ..._users] = await ethers.getSigners();
    signer = _signer;

    let tokenInput1: TokenInputStruct = {
      tokenId: 0,
      tokenURI: "ipfs://1.json",
      status: true,
      paymentToken: ZERO_ADDRESS,
      amount: ethers.utils.parseEther("1"),
      price: ethers.utils.parseEther("1"),
    };

    let tokenInput2: TokenInputStruct = {
      tokenId: 0,
      tokenURI: "ipfs://2.json",
      status: true,
      paymentToken: ZERO_ADDRESS,
      amount: ethers.utils.parseEther("1"),
      price: ethers.utils.parseEther("1"),
    };

    const hash = await verifySignature.getMessageHash(
      tokenInput1.tokenId,
      tokenInput1.tokenURI,
      tokenInput1.paymentToken,
      tokenInput1.price,
      tokenInput1.amount,
      tokenInput1.status
    );
    const sig = await signer.signMessage(ethers.utils.arrayify(hash));
    const ethHash = await verifySignature.getEthSignedMessageHash(hash);

    console.log("Signer:         ", signer.address);
    console.log(
      "Recover signer: ",
      await verifySignature.recoverSigner(ethHash, sig)
    );

    // Check correct hash
    expect(
      await verifySignature.verify(signer.address, tokenInput1, sig)
    ).to.be.equal(true);

    // Check wrong hash
    expect(
      await verifySignature.verify(signer.address, tokenInput2, sig)
    ).to.be.equal(false);
  });
});
