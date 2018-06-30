# free-nim-bot

## How to add to your server
You can [install my hosted version](https://discordapp.com/oauth2/authorize?client_id=441329117946707978&scope=bot) of this software. However, only admins can add bots to servers. @free-nim-bot will **not** have admin rights, though. You can [try it on an example server](https://discord.gg/vCYkWJc), too.

## Commands
All commands are case-insensitive.

### !tip nimiq address [tip amount] 
Sends NIM, on chain, to that address. If you don't specify a tip amount, it defaults to 0.2 NIM.

### !tip @discord_username [tip amount]
Sends NIM to that user’s tip balance, off-chain. If you don't specify a tip amount, it defaults to 0.2 NIM.

### !balance
Shows you your tip balance

### !withdraw *nimiq address*
Sends your entire tip balance to that address, on-chain.

### !deposit
Gives you instructions on how to deposit.

### !github
Gives you a link to the github.

You can send the commands by DMing @nim-tip-bot, or in any Discord server that has the bot on it.


## How to make a self-hosted installation
1. Install the [Nimiq compiled binary](https://nimiq.com/#downloads), on your Ubuntu/Debian system.
2. Clone this repo.
3. Run ``npm install``.
4. [Make a Nimiq private key](https://safe.nimiq.com), and put it in ``privateKey.js``. It is recommended that you use a different address then your usual address for this tipbot.
5. In privateKey.js, put ``module.exports = "your twenty four words";``
6. Give a few NIM to your new address.
7. Follow [this guide](https://github.com/reactiflux/discord-irc/wiki/Creating-a-discord-bot-&-getting-a-token) to get a Discord token. Put your secret in discordToken.js, like: 
```json
{
  "token": "put your token here"
}
```
9. Create ``db.json``. This will store all of the tipbot data.
10. Copy your discord user ID, like so (in any Discord channel): ![Type in \@yourusername, and take the numbers.](https://vgy.me/DlDWdw.gif)
11. Put this in ``db.json``:
```json
{
  "userBalances": {
    "YOUR USER ID": 99999999999999
  },
  "blacklist": []
}
```
12. In the Discord dev console, get your app's ID: ![Copy what's after "Client ID:"](https://vgy.me/lj7dKU.gif)
13. Go to ``https://discordapp.com/oauth2/authorize?client_id=YOUR APP ID&scope=bot``
14. You can now add your bot to a server.
