async function main() {
  const Nimiq = require("./nimiq/lib/node.js");
  Nimiq.GenesisConfig.test(); //do this on testnet
  const Buffer = require("buffer").Buffer;
  const MnemonicPhrase = require("./phrases.js");
  const privateKey = Buffer.from(MnemonicPhrase.mnemonicToKey(require("./privateKey.js")), "hex");

  const key = new Nimiq.PrivateKey(privateKey);
  const keyPair = Nimiq.KeyPair.derive(key);
  const wallet = new Nimiq.Wallet(keyPair);

  const consensus = await Nimiq.Consensus.light();
  consensus.network.connect();
  async function sendTo(address) {
    console.log("!!!!!!!!!!!!!!");
    var transaction = wallet.createTransaction(Nimiq.Address.fromUserFriendlyAddress(address), 1337, 3, consensus.blockchain.head.height);
    await consensus.mempool.pushTransaction(transaction);
  }
  consensus.on('established', async () => {
    // code that requires network consensus
    await sendTo("NQ92 589S 4CN6 U0FX NQRV NHQP TQNV CF1U BVHU");
  });
  Nimiq.Log.instance.level = 1;
}
main();