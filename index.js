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
  if (!db.lastUserVerifies) db.lastUserVerifies = {};
  if (!db.lastUserVerifies) db.lastUserVerifies = {};
  if (!db.txFeeBalance) db.txFeeBalance = 76543;

  Nimiq.GenesisConfig.main();
  const privateKey = Buffer.from(MnemonicPhrase.mnemonicToKey(require("./privateKey.js")), "hex");

  const key = new Nimiq.PrivateKey(privateKey);
  const keyPair = Nimiq.KeyPair.derive(key);
  const wallet = new Nimiq.Wallet(keyPair);

  logger.verbose("Loaded private key.");

  const consensus = await Nimiq.Consensus.light();
  consensus.network.connect();
  async function sendTo(address, amount) {
    db.txFeeBalance -= 140;
    saveDB();
    logger.debug("Sent NIM to " + address)
    var transaction = wallet.createTransaction(address, amount ? amount : 20000, 140, consensus.blockchain.head.height);
    await consensus.mempool.pushTransaction(transaction);
  }
  var ready = false;
  consensus.on("established", async () => {
    logger.verbose("Consensus established");
    const bot = new Discord.Client();
    var historyChannel;
    bot.on("ready", function (evt) {
      logger.info("Logged in to Discord.");
      historyChannel = bot.channels.get("443512282664927233");
    });
    if (ready) return;
    ready = true;
    bot.on("message", async function (msg) {
      if (db.blacklist.indexOf(msg.author.id) > -1) {
        console.log("On blacklist, ", msg.author.id);
        return;
      }
      logger.silly("Got message, " + msg.content);
      var address = AddressFinder(msg.content);
      msg.content = msg.content.toLowerCase();
      if (msg.content.indexOf("!github") === 0) {
        return msg.reply(`Visit our GitHub page to contribute: https://github.com/Smittyvb/nimiq-tip-bot
`);
      }
      if (msg.content.indexOf("!help") === 0) {
        return msg.reply(`
Commands:
—
!tip nimiq address [tip amount]
Sends NIM, on chain, to that address. If you don't specify a tip amount, it defaults to 0.2 NIM.
—
!tip @discord_username [tip amount]
Sends NIM to that user’s tip balance, off-chain. If you don't specify a tip amount, it defaults to 0.2 NIM.
—
!balance
Shows you your tip balance
—
!withdraw nimiq address
Sends your entire tip balance to that address, on-chain.
—
!deposit
Gives you instructions on how to deposit.
—
!github
Gives you a link to the github.
_
You can send the commands by DMing <@441329117946707978>, or in any Discord server that has the bot on it.
This is a community run bot. It is not associated with the Nimiq Foundation, or the Nimiq Team.  If you have any feedback, or questions, direct it to <@384847091924729856>, or post it in the bot's Discord server (<https://discord.gg/KFc8gK2>).
Need help? Contact <@384847091924729856>. Or, check out the #support channel in the example server - <https://discord.gg/KFc8gK2>.
`);
      }
      if (msg.content.indexOf("!balance") === 0) {
        if (db.userBalances[msg.author.id]) {
          return msg.reply("Your balance is " + parseFloat((db.userBalances[msg.author.id] / 100000).toFixed(5), 10) + " NIM.");
        } else {
          return msg.reply("You have no balance.");
        }
        return;
      }
      if (msg.content.indexOf("!txfeeinfo") === 0) {
        return msg.reply("I have enough NIM to pay for " + Math.floor(db.txFeeBalance / 140) + " transactions.");
      }
      if (msg.content.indexOf("!savedb") === 0) {
        saveDB();
        return msg.reply("Saved the database!");
      }
      if (msg.content.indexOf("!withdraw") === 0) {
        if (address) {
          logger.debug("Parsed address, " + address);
          if (db.txFeeBalance < 140) {
            return msg.reply("Sorry, something very bad happened. I can't afford the transaction fee. Please try again, later.");
          }
          try {
            const hexAddess = Nimiq.Address.fromUserFriendlyAddress(address.toUpperCase());
            await sendTo(hexAddess, Math.floor(db.userBalances[msg.author.id]));
            var sentAmount = Math.floor(db.userBalances[msg.author.id]);
            db.userBalances[msg.author.id] = 0;
            saveDB();
            msg.reply("You have sent your balance to that address.");
            if (msg.channel.type !== "dm") {
              historyChannel.send("@" + msg.author.username + " tipped " + address.toUpperCase() + " " + (sentAmount * 100000) + " NIM.");
            }
          } catch (e) {console.log(e);}
        }
        return;
      }
      if (msg.content.indexOf("!deposit") === 0) {
        //return msg.reply("Depositing is currently disabled.");
        if ((msg.content.indexOf("!depositforce") !== 0) && (msg.channel.type !== "dm")) { 
          return msg.reply("Deposits are not possible on a server for privacy and security reasons. To add funds to your account, please Direct Message me with !deposit.");
        }
        var keyPair = Nimiq.KeyPair.generate();
        var walletAddress = Nimiq.Address.fromHash(keyPair.publicKey.hash()).toUserFriendlyAddress();
        var verifyCode = (Date.now() - 1525605947934).toString(36) //Milliseconds since I wrote this line, in base36
                           + Math.random().toString(36).split("0.")[1]; //A random number, in base36
        db.keyPairs[verifyCode] = {
          privateKey: keyPair.privateKey.toHex(),
          user: msg.author.id,
          used: false
        };
        db.lastUserVerifies[msg.author.id] = verifyCode;
        saveDB();
        msg.reply(
          `**THIS IS A TIPBOT, NOT A WALLET!**
It is recommended **not to store large amounts of NIM** on this bot! You don't control the private key of your funds and they may be lost! If you wish to continue, send your NIM to` 
        );
        msg.channel.send("``" + Nimiq.Address.fromHash(keyPair.publicKey.hash()).toUserFriendlyAddress() + "``"); +
        msg.channel.send("After your funds have arrived (when the transaction is no longer \"pending\" in the safe), run");
        msg.channel.send("``" + "!verify " + verifyCode + "``");
        return;
      }
      if (msg.content.indexOf("!verify") === 0) {
        msg.content = msg.content.trim();
        var publicKey = msg.content.split("!verify")[1].trim();
        if (!db.keyPairs[publicKey]) {
          if (db.lastUserVerifies[msg.author.id]) {
            if (publicKey === "") {
              publicKey = db.lastUserVerifies[msg.author.id];
            } else {
              msg.reply("Sorry, it doesn't look like that !verify code exists. Did you mean: ");
              return msg.channel.send("!verify " + db.lastUserVerifies[msg.author.id]);
            }
          } else {
            return msg.reply("Sorry, it doesn't look like that !verify code exists. I also can't find any verifies in your history.");
          }
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
        if (!db.userBalances[walletInfo.user]) db.userBalances[walletInfo.user] = 0;
        db.userBalances[walletInfo.user] += balance;
        db.keyPairs[publicKey].used = true;
        db.lastUserVerifies[msg.author.id] = null;
        //We don't need a transaction fee, because this will be this wallet's only transfer, ever.
        var transaction = userWallet.createTransaction(wallet.address, balance, 0, consensus.blockchain.head.height);
        await consensus.mempool.pushTransaction(transaction);
        msg.reply("It worked! " + parseFloat((balance / 100000).toFixed(5), 10) + " NIM has been credited to your account. **DO NOT** reuse this address. Instead, request a new one with !deposit, if you want to deposit more.");
        saveDB();
        return;
      }
      if (msg.content.indexOf("!tip") !== 0) {
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
        amountToSend = Math.floor(amountToSend);
        if (amountToSend === 0) {
          msg.reply("You cannot send 0 NIM.");
          return;
        }
      if (!db.userBalances[msg.author.id] || (db.userBalances[msg.author.id] < amountToSend)) {
        return msg.reply("Sorry, you don't have enough balance with this tip-bot, to make that tip.");
      }
      console.log(msg.channel.type);
      if (address) {
        logger.debug("Parsed address, " + address);
        try {
          if (db.txFeeBalance < 140) {
            return msg.reply("Sorry, something very bad happened. I can't afford the transaction fee. Please try again, later.");
          }
          const hexAddess = Nimiq.Address.fromUserFriendlyAddress(address.toUpperCase());
          await sendTo(hexAddess, amountToSend);
          db.userBalances[msg.author.id] -= amountToSend;
          saveDB();
          msg.channel.send("<@" + msg.author.id + "> tipped " + parseFloat((amountToSend / 100000).toFixed(5), 10) + " NIM to that address.");
          if (msg.channel.type !== "dm") {  
            historyChannel.send("@" + msg.author.username + " tipped " + address.toUpperCase() + " " + parseFloat((amountToSend / 100000).toFixed(5), 10) + " NIM.");
          }
        } catch (e) {}
      } else {
        try {
          var sendToUser = msg.content.match(/<@!?(\d*)>/)[1];
          if ((sendToUser === "441329117946707978") || (sendToUser === "1")) {
            db.txFeeBalance += amountToSend;
            saveDB();
            msg.reply("Adding that to the transaction fee paying pool. Because you tipped me, I'll use your funds to pay for transaction fees.");
          }
          db.userBalances[msg.author.id] -= amountToSend;
          if (!db.userBalances[sendToUser]) db.userBalances[sendToUser] = 0;
          db.userBalances[sendToUser] += amountToSend;
          var sendToDUser = bot.users.get(sendToUser);
          saveDB();
          msg.channel.send("<@" + msg.author.id + "> tipped @" + sendToDUser.username + " " + parseFloat((amountToSend / 100000).toFixed(5), 10) + " NIM.");
          if (msg.channel.type === "dm") {          
            sendToDUser.send("You got tipped " + parseFloat((amountToSend / 100000).toFixed(5)) + " NIM by " + bot.users.get(msg.author.id).username + ".");
          } else {
            setTimeout(function () {
              historyChannel.send("@" + msg.author.username + " tipped @" + sendToDUser.username + " " + parseFloat((amountToSend / 100000).toFixed(5)) + " NIM.");
            }, 7500);
          }
        } catch (e) {console.log("werid", e)}
      }
    });
    bot.on("error", function (a) {logger.error("Discord error... ");});
    bot.login(DiscordAuth.token);
    logger.info("Discord bot configured.");
  });
  Nimiq.Log.instance.level = 4;
}
main();
