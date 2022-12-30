import { upgrades } from "hardhat";
import { ethers } from "hardhat";
import hre from "hardhat";
import { expect } from "chai";
import { ZERO_ADDRESS } from "@openzeppelin/test-helpers/src/constants";
import { BigNumber, Contract } from "ethers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { TokenInputStruct } from "../../typechain-types/contracts/ERC721";

const tokenName = "Token";
const symbol = "TKN";
const decimal = 12;
const tokenURI = "ipfs://tokenURI";
const sampleSignature =
  "0x1c8aff950685c2ed4bc3174f3472287b56d9517b9c948127319a09a7a36deac8";
const YEAR_TO_SECONDS = 31_556_926;
const NONEXISTENT_TOKEN_ID = 9999;
const royaltyPercentage = 10;

describe("ERC721 Integration", () => {
  let erc721: Contract;
  let cashTestToken: Contract;
  let owner: SignerWithAddress;
  let admin: SignerWithAddress;
  let verifier: SignerWithAddress;
  let royaltyReceiver: SignerWithAddress;
  let users: SignerWithAddress[];
  let expiration: BigNumber;
  let tokenInput: TokenInputStruct = {
    tokenId: 0,
    tokenURI: "",
    paymentToken: ZERO_ADDRESS,
    amount: 0,
    price: 0,
    status: true,
  };

  beforeEach(async () => {
    const ERC721 = await hre.ethers.getContractFactory("ERC721");
    const CashTestToken = await hre.ethers.getContractFactory("CashTestToken");
    const [_owner, _admin, _verifier, _royaltyReceiver, ..._users] =
      await hre.ethers.getSigners();
    owner = _owner;
    admin = _admin;
    verifier = _verifier;
    users = _users;
    royaltyReceiver = _royaltyReceiver;

    erc721 = await upgrades.deployProxy(ERC721, [
      owner.address,
      tokenName,
      symbol,
      YEAR_TO_SECONDS,
      royaltyReceiver.address,
      royaltyPercentage,
    ]);
    await erc721.deployed();

    cashTestToken = await CashTestToken.deploy(tokenName, symbol, decimal);
    await cashTestToken.deployed();

    await erc721.connect(owner).setAdmin(admin.address);
    await erc721.connect(admin).setVerifier(verifier.address);

    const allowance = ethers.utils.parseUnits("1000", decimal);
    await cashTestToken.mintForList(
      [users[0].address, users[1].address, users[2].address],
      allowance
    );
    await cashTestToken.connect(users[0]).approve(erc721.address, allowance);
    await cashTestToken.connect(users[0]).approve(erc721.address, allowance);
    await cashTestToken.connect(users[0]).approve(erc721.address, allowance);
  });

  describe("1. Mint token => Transfer token", () => {
    it("1.1. Should be successfull", async () => {
      // Mint token
      tokenInput.tokenURI = "ipfs://1.json";
      tokenInput.price = ethers.utils.parseEther("1");
      tokenInput.amount = ethers.utils.parseEther("1");
      const hash = await erc721.getMessageHash(
        tokenInput.tokenId,
        tokenInput.tokenURI,
        tokenInput.paymentToken,
        tokenInput.price,
        tokenInput.amount,
        tokenInput.status
      );
      let signature = verifier.signMessage(ethers.utils.arrayify(hash));

      await erc721.mint(users[0].address, tokenInput, signature, {
        value: ethers.utils.parseEther("1"),
      });

      // Transfer token
      let tokenId = await erc721.lastId();
      await erc721.connect(users[0]).transfer(users[1].address, tokenId);
      expect(await erc721.ownerOf(tokenId)).to.be.equal(users[1].address);
    });
  });
});
