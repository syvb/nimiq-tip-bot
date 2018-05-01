const Nimiq = require("./nimiq/lib/node.js");
const Buffer = require("buffer").Buffer;
const MnemonicPhrase = require("./phrases.js");
const AddressFinder = require("./getAddress.js");
const DiscordAuth = require("./discordAuth.json");
const Discord = require("discord.io");
const logger = require("winston");
logger.info("Starting...");

async function main() {
  Nimiq.GenesisConfig.test(); //do this on testnet
  logger.remove(logger.transports.Console);
  logger.add(logger.transports.Console, {
    colorize: true
  });
  logger.level = "debug";
  const privateKey = Buffer.from(MnemonicPhrase.mnemonicToKey(require("./privateKey.js")), "hex");

  const key = new Nimiq.PrivateKey(privateKey);
  const keyPair = Nimiq.KeyPair.derive(key);
  const wallet = new Nimiq.Wallet(keyPair);

  const consensus = await Nimiq.Consensus.light();
  consensus.network.connect();
  async function sendTo(address) {
    logger.info("Sent NIM to " + address)
    var transaction = wallet.createTransaction(Nimiq.Address.fromUserFriendlyAddress(address), 1337, 3, consensus.blockchain.head.height);
    await consensus.mempool.pushTransaction(transaction);
  }
  consensus.on("established", async () => {
    // verify that it worked
    await sendTo("NQ92 589S 4CN6 U0FX NQRV NHQP TQNV CF1U BVHU");

    const bot = new Discord.Client({
      token: DiscordAuth.token,
      autorun: true
    });
    bot.on("ready", function (evt) {
      logger.info("Connected");
      logger.info("Logged in as: ");
      logger.info(bot.username + " - (" + bot.id + ")");
    });
    bot.on("message", function (user, userID, channelID, message, evt) {
      logger.info("Got message, " + message);
      var address = AddressFinder(message);
      logger.info("Parsed address, " + address);
      if (address) {
        try {
          sendTo(address);
        } catch (e) {}
      }
    });
    logger.info("Discord bot configured.");
  });
  Nimiq.Log.instance.level = 4;
}
main();