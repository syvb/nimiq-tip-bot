const logger = require("winston");
logger.info("Starting...");
const Nimiq = require("./nimiq/lib/node.js");
const Buffer = require("buffer").Buffer;
const MnemonicPhrase = require("./phrases.js");
const AddressFinder = require("./getAddress.js");
const DiscordAuth = require("./discordAuth.json");
const Discord = require("discord.js");
const fs = require("fs");

var rateLimitedIDs = {};

var db = JSON.parse(fs.readFileSync("./db.json", "utf8"));

async function main() {
  logger.remove(logger.transports.Console);
  logger.add(logger.transports.Console, {
    colorize: true
  });
  logger.level = "debug";
  logger.verbose("Logging system ready.");

  function saveDB(cb) {
    fs.writeFile("db.json", JSON.stringify(db), function (err) {
      if (err) throw err;
      if (cb) cb();
    });
  }

  Nimiq.GenesisConfig.main();
  const privateKey = Buffer.from(MnemonicPhrase.mnemonicToKey(require("./privateKey.js")), "hex");

  const key = new Nimiq.PrivateKey(privateKey);
  const keyPair = Nimiq.KeyPair.derive(key);
  const wallet = new Nimiq.Wallet(keyPair);

  logger.verbose("Loaded private key.");

  const consensus = await Nimiq.Consensus.light();
  consensus.network.connect();
  async function sendTo(address) {
    logger.debug("Sent NIM to " + address)
    var transaction = wallet.createTransaction(address, 2000, 140, consensus.blockchain.head.height);
    await consensus.mempool.pushTransaction(transaction);
  }
  consensus.on("established", async () => {
    logger.verbose("Consensus established");
    const bot = new Discord.Client();
    bot.on("ready", function (evt) {
      console.log(42);
      logger.info("Logged in to Discord as: " + bot.username + " - (" + bot.id + ")");
    });
    bot.on("message", async function (msg) {
      logger.silly("Got message, " + msg.content);
      var address = AddressFinder(msg.content);
      if (msg.content.indexOf("!tip") !== 0) {
        return;
      }
      if (db.blacklist[msg.author.id]) {
        console.log("On blacklist, ", msg.author.id);
        return;
      }
      if (!db.userBalances[msg.author.id] || (db.userBalances[msg.author.id] <= 2140)) {
        return msg.reply("Sorry, you don't have enough balance with this tip-bot, to tip.");
      }
      if (address) {
        logger.debug("Parsed address, " + address);
        try {
          const hexAddess = Nimiq.Address.fromUserFriendlyAddress(address);
          if (!rateLimitedIDs[msg.author.id]) {
            rateLimitedIDs[msg.author.id] = 1;
          } else {
            rateLimitedIDs[msg.author.id]++;
          }
          if (rateLimitedIDs[msg.author.id] > 3) {
            //return;
          }
          await sendTo(hexAddess);
          db.userBalances[msg.author.id] -= 2140;
          saveDB();
          msg.reply("You have sent 0.02 NIM to that address.");
        } catch (e) {throw e;}
      }
    });
    bot.on("error", function (a) {console.log("a" + a);})
    bot.login(DiscordAuth.token);
    logger.info("Discord bot configured.");
  });
  Nimiq.Log.instance.level = 5;
}
main();
setInterval(function () {
  logger.verbose("Reset rate-limted IDs");
  rateLimitedIDs = {};
}, 900000); // 14 minutes