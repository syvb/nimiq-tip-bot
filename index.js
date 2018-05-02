const logger = require("winston");
logger.info("Starting...");
const Nimiq = require("./nimiq/lib/node.js");
const Buffer = require("buffer").Buffer;
const MnemonicPhrase = require("./phrases.js");
const AddressFinder = require("./getAddress.js");
const DiscordAuth = require("./discordAuth.json");
const Discord = require("discord.io");

var rateLimitedIDs = {};

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

  const consensus = await Nimiq.Consensus.nano();
  consensus.network.connect();
  async function sendTo(address) {
    logger.debug("Sent NIM to " + address)
    var transaction = wallet.createTransaction(address, 2000, 140, consensus.blockchain.head.height);
    await consensus.relayTransaction(transaction);
  }
  consensus.on("established", async () => {
    logger.verbose("Consensus established");
    const bot = new Discord.Client({
      token: DiscordAuth.token,
      autorun: true
    });
    bot.on("ready", function (evt) {
      logger.info("Logged in to Discord as: " + bot.username + " - (" + bot.id + ")");
    });
    bot.on("message", async function (user, userID, channelID, message, evt) {
      logger.silly("Got message, " + message);
      var address = AddressFinder(message);
      if (userID !== "384847091924729856") {
        return;
      }
      if (message.indexOf("!tip") === -1) {
        return;
      }
      if (address) {
        logger.debug("Parsed address, " + address);
        try {
          const hexAddess = Nimiq.Address.fromUserFriendlyAddress(address);
          if (!rateLimitedIDs[userID]) {
            rateLimitedIDs[userID] = 1;
          } else {
            rateLimitedIDs[userID]++;
          }
          if (rateLimitedIDs[userID] > 3) {
            //return;
          }
          await sendTo(hexAddess);
          bot.sendMessage({ to: channelID, message: "<@" + userID + ">, you have received 0.1 testnet NIM to that address."});
        } catch (e) {}
      }
    });
    logger.info("Discord bot configured.");
  });
  Nimiq.Log.instance.level = 4;
}
main();
setInterval(function () {
  logger.verbose("Reset rate-limted IDs");
  rateLimitedIDs = {};
}, 900000); // 14 minutes