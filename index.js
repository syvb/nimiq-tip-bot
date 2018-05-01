const logger = require("winston");
logger.info("Starting...");
const Nimiq = require("./nimiq/lib/node.js");
const Buffer = require("buffer").Buffer;
const MnemonicPhrase = require("./phrases.js");
const AddressFinder = require("./getAddress.js");
const DiscordAuth = require("./discordAuth.json");
const Discord = require("discord.io");

async function main() {
  logger.remove(logger.transports.Console);
  logger.add(logger.transports.Console, {
    colorize: true
  });
  logger.level = "debug";
  logger.verbose("Logging system ready.");

  Nimiq.GenesisConfig.test(); //do this on testnet
  const privateKey = Buffer.from(MnemonicPhrase.mnemonicToKey(require("./privateKey.js")), "hex");

  const key = new Nimiq.PrivateKey(privateKey);
  const keyPair = Nimiq.KeyPair.derive(key);
  const wallet = new Nimiq.Wallet(keyPair);

  logger.verbose("Loaded private key.");

  const consensus = await Nimiq.Consensus.light();
  consensus.network.connect();
  async function sendTo(address) {
    logger.debug("Sent NIM to " + address)
    var transaction = wallet.createTransaction(Nimiq.Address.fromUserFriendlyAddress(address), 1337, 3, consensus.blockchain.head.height);
    await consensus.mempool.pushTransaction(transaction);
  }
  consensus.on("established", async () => {
    // verify that it worked
    await sendTo("NQ92 589S 4CN6 U0FX NQRV NHQP TQNV CF1U BVHU");
    logger.verbose("Consensus established");
    const bot = new Discord.Client({
      token: DiscordAuth.token,
      autorun: true
    });
    bot.on("ready", function (evt) {
      logger.info("Logged in to Discord as: " + bot.username + " - (" + bot.id + ")");
    });
    bot.on("message", function (user, userID, channelID, message, evt) {
      logger.silly("Got message, " + message);
      var address = AddressFinder(message);
      if (address) {
        logger.debug("Parsed address, " + address);
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