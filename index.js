const logger = require("winston");
logger.info("Starting...");
const Nimiq = require("/usr/share/nimiq/app/lib/node.js");
const Buffer = require("buffer").Buffer;
const MnemonicPhrase = require("./phrases.js");
const AddressFinder = require("./getAddress.js");
const DiscordAuth = require("./discordAuth.json");
const Discord = require("discord.js");
const fs = require("fs");

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
  if (!db.keyPairs) db.keyPairs = {};

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
      logger.info("Logged in to Discord.");
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
      if (msg.content.indexOf("!deposit") === 0) {
        var keyPair = Nimiq.KeyPair.generate();
        var walletAddress = Nimiq.Address.fromHash(keyPair.publicKey.hash()).toUserFriendlyAddress();
        db.keyPairs[keyPair.publicKey.toHex()] = {
          privateKey: keyPair.privateKey.toHex(),
          user: msg.author.id,
          used: false
        };
        saveDB();
        msg.reply(
          `If you wish to deposit to this tipbot, you may do so. However, remember that this is a tipbot, **not** a wallet. It is recommended that you do not store a large amount of NIM with a tipbot. \n` +
          "Please send your NIM to " + Nimiq.Address.fromHash(keyPair.publicKey.hash()).toUserFriendlyAddress() + ". \n Then, run \"!verify " + keyPair.publicKey.toHex() + "\"");
        return;
      }
      if (msg.content.indexOf("!verify") === 0) {
        msg.content = msg.content.trim();
        var publicKey = msg.content.split("!verify")[1].trim();
        if (!db.keyPairs[publicKey]) {
          return msg.reply("Sorry, it doesn't look like that address has been used.");
        }
        var walletInfo = db.keyPairs[publicKey];
        if (walletInfo.user !== msg.author.id) {
          return msg.reply("Sorry, that address cannot be used by you.");
        }
        if (walletInfo.used) {
          return msg.reply("Sorry, addresses can only be used once. However, you can message support (<@384847091924729856>), to have this resolved.");
        }
        var userKey = new Nimiq.PrivateKey(Buffer.from(walletInfo.privateKey, "hex"));
        var userKeyPair = Nimiq.KeyPair.derive(userKey);
        var userWallet = new Nimiq.Wallet(userKeyPair);
//console.log(Nimiq.Address.fromHash(userKeyPair.publicKey).toUserFriendlyAddress())
        var balance = (await consensus.blockchain.accounts.get(userWallet.address)).balance;
        console.log(balance + "!");
        if (balance === 0) {
          return msg.reply("No NIM was sent to that address.");
        }
        db.userBalances[walletInfo.user] += balance;
        db.keyPairs[publicKey].used = true;
    var transaction = userWallet.createTransaction(wallet.address, balance - 141, 140, consensus.blockchain.head.height);
    await consensus.mempool.pushTransaction(transaction);
        msg.reply("It worked! " + (balance / 100000) + " NIM has been credited to your account. **DO NOT** reuse this address. Instead, request a new one with !deposit, if you want to deposit more.");
        saveDB();
        return;
      }
      if (msg.content.indexOf("!tip") !== 0) {
        return;
      }
      if (db.blacklist[msg.author.id]) {
        console.log("On blacklist, ", msg.author.id);
        return;
      }

        var amountToSend = 20000;
        try {
          amountToSend = msg.content.match(/(\d|\.)*$/)[0].trim();
        }
        catch (e) {}
        var dots = msg.content.match(/\./);
console.log(amountToSend);
        if (dots && (dots.length > 2)) {
          return msg.reply("I don't understand that number.");
        }
        if (amountToSend === "") {
          amountToSend = 20000;
        } else {
          amountToSend = parseFloat(amountToSend, 10) * 100000;
        }
        if (amountToSend === 0) {
          msg.reply("You cannot send 0 NIM.");
          return;
        }
      if (!db.userBalances[msg.author.id] || (db.userBalances[msg.author.id] < amountToSend)) {
        return msg.reply("Sorry, you don't have enough balance with this tip-bot, to make that tip.");
      }
      if (address) {
        logger.debug("Parsed address, " + address);

        try {
          const hexAddess = Nimiq.Address.fromUserFriendlyAddress(address.toUpperCase());
          await sendTo(hexAddess);
          db.userBalances[msg.author.id] -= amountToSend;
          saveDB();
          msg.reply("You have sent " + (amountToSend / 100000) + " NIM to that address.");
        } catch (e) {}
      } else {
        try {
          var sendToUser = msg.content.match(/<@!?(\d*)>/)[1];
          db.userBalances[msg.author.id] -= amountToSend;
          if (!db.userBalances[sendToUser]) db.userBalances[sendToUser] = 0;
          db.userBalances[sendToUser] += amountToSend;
          msg.reply("Sent. <@" + sendToUser + "> has received a tip of " + amountToSend / 100000 + " NIM.");
          saveDB();
        } catch (e) {}
      }
    });
    bot.on("error", function (a) {logger.error("Discord error, ", a.toString());});
    bot.login(DiscordAuth.token);
    logger.info("Discord bot configured.");
  });
  Nimiq.Log.instance.level = 4;
}
main();
