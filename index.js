const logger = require("winston");
logger.info("Starting...");
const Nimiq = require("/usr/share/nimiq/app/lib/node.js");
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
  async function sendTo(address, amount) {
    logger.debug("Sent NIM to " + address)
    var transaction = wallet.createTransaction(address, amount ? amount : 20000, 140, consensus.blockchain.head.height);
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
      msg.content = msg.content.toLowerCase();
      if (msg.content.indexOf("!balance") === 0) {
        if (db.userBalances[msg.author.id]) {
          return msg.reply("Your balance is " + db.userBalances[msg.author.id] / 100000 + " NIM.");
        } else {
          return msg.reply("You have no balance.");
        }
        return;
      }
      if (msg.content.indexOf("!withdraw") === 0) {
        if (address) {
          logger.debug("Parsed address, " + address);
          try {
            const hexAddess = Nimiq.Address.fromUserFriendlyAddress(address.toUpperCase());
            await sendTo(hexAddess, db.userBalances[msg.author.id]);
            db.userBalances[msg.author.id] = 0;
            saveDB();
            msg.reply("You have sent your balance to that address.");
          } catch (e) {console.log(e);}
        }
        return;
      }
      if (msg.content.indexOf("!tip") !== 0) {
        return;
      }
      if (db.blacklist[msg.author.id]) {
        console.log("On blacklist, ", msg.author.id);
        return;
      }
      if (!db.userBalances[msg.author.id] || (db.userBalances[msg.author.id] <= 20000)) {
        return msg.reply("Sorry, you don't have enough balance with this tip-bot, to tip.");
      }
      if (address) {
        logger.debug("Parsed address, " + address);
        try {
          const hexAddess = Nimiq.Address.fromUserFriendlyAddress(address.toUpperCase());
          if (!rateLimitedIDs[msg.author.id]) {
            rateLimitedIDs[msg.author.id] = 1;
          } else {
            rateLimitedIDs[msg.author.id]++;
          }
          if (rateLimitedIDs[msg.author.id] > 3) {
            //return;
          }
          await sendTo(hexAddess);
          db.userBalances[msg.author.id] -= 20000;
          saveDB();
          msg.reply("You have sent 0.2 NIM to that address.");
        } catch (e) {}
      } else {
        try {
          var sendToUser = msg.content.match(/<@!?(\d*)>/)[1];
          db.userBalances[msg.author.id] -= 20000;
          if (!db.userBalances[sendToUser]) db.userBalances[sendToUser] = 0;
          db.userBalances[sendToUser] += 20000;
          msg.reply("Sent. <@" + sendToUser + "> has received a tip of 0.2 NIM.");
          saveDB();
        } catch (e) {}
      }
    });
    bot.on("error", function (a) {console.log("a" + a);})
    bot.login(DiscordAuth.token);
    logger.info("Discord bot configured.");
  });
  Nimiq.Log.instance.level = 4;
}
main();
setInterval(function () {
  logger.verbose("Reset rate-limted IDs");
  rateLimitedIDs = {};
}, 900000); // 14 minutes
