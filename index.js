const fs = require('fs');
const Discord = require('discord.js');
const { prefix, token } = require('./config.json');

const mc = "661614179358343189";
const rust = "661613866848878623";
const lol = "661613866962255873";
const weed = "661613867033559041";
const taylor = "246841041678893056";
const eso = "661618733021790230";
const halo = "661618733160333333";
const apex = "661637727518851072";
const cod = "661637910747152464";
const plex = "661619695509700618";

const mcRole = "661615504825253938";
const rustRole = "661281309640884235";
const lolRole = "661636677244289093"
const weedRole = "661614906654588938";
const taylorRole = "661615163140603935";
const esoRole = "661619051348492290";
const haloRole = "661619050547511327";
const apexRole = "661615423040651336";
const codRole = "661281357959528458";
const plexRole = "611315151102148781";

//    Add emoji name

var emojiname = [mc, rust, lol, weed, taylor, eso, halo, apex, cod, plex];

//    Add role name
var rolename = [mcRole, rustRole, lolRole, weedRole, taylorRole, esoRole, haloRole, apexRole, codRole, plexRole];

const client = new Discord.Client();
client.commands = new Discord.Collection();

const commandFiles = fs.readdirSync('./commands').filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
	const command = require(`./commands/${file}`);
	client.commands.set(command.name, command);
}

const cooldowns = new Discord.Collection();

client.once('ready', () => {
	console.log('Ready!');

	//added by andre;
	client.channels.get("661280984246911016").fetchMessage('661660353654161530');

	// client.channels.get("661280984246911016").send("Select a topic to subscribe to!")
	// 	.then(async function (message) {

	// 		for (i = 0; i < emojiname.length; i++) {
	// 			await message.react(emojiname[i])

	// 		}

	// 	})
});



client.on('message', message => {
	if (!message.content.startsWith(prefix) || message.author.bot) return;

	const args = message.content.slice(prefix.length).split(/ +/);
	const commandName = args.shift().toLowerCase();

	const command = client.commands.get(commandName)
		|| client.commands.find(cmd => cmd.aliases && cmd.aliases.includes(commandName));

	if (!command) return;

	if (command.guildOnly && message.channel.type !== 'text') {
		return message.reply('I can\'t execute that command inside DMs!');
	}

	if (command.args && !args.length) {
		let reply = `You didn't provide any arguments, ${message.author}!`;

		if (command.usage) {
			reply += `\nThe proper usage would be: \`${prefix}${command.name} ${command.usage}\``;
		}

		return message.channel.send(reply);
	}

	if (!cooldowns.has(command.name)) {
		cooldowns.set(command.name, new Discord.Collection());
	}

	const now = Date.now();
	const timestamps = cooldowns.get(command.name);
	const cooldownAmount = (command.cooldown || 3) * 1000;

	if (timestamps.has(message.author.id)) {
		const expirationTime = timestamps.get(message.author.id) + cooldownAmount;

		if (now < expirationTime) {
			const timeLeft = (expirationTime - now) / 1000;
			return message.reply(`please wait ${timeLeft.toFixed(1)} more second(s) before reusing the \`${command.name}\` command.`);
		}
	}

	timestamps.set(message.author.id, now);
	setTimeout(() => timestamps.delete(message.author.id), cooldownAmount);

	try {
		command.execute(message, args);
	} catch (error) {
		console.error(error);
		message.reply('there was an error trying to execute that command!');
	}
});
client.on("messageReactionAdd", (reaction, user) => {

	if(reaction.message.channel.id !="661280984246911016"){
		return;
	} 

	if (!user) return;

	if (user.bot) return;

	if (!reaction.message.channel.guild) return;

	for (let n in emojiname) {
		
		if (reaction.emoji.id == emojiname[n]) {
			reaction.message.guild.member(user).addRole(rolename[n]).catch(console.error);
		}
	}

});

client.on("messageReactionRemove", (reaction, user) => {
// 	console.log(reaction.message.channel.id);
// 	//console.log(reaction.message.channel);
// 	console.log(reaction.message.channel.name);
// console.log(reaction.message.channel.id==661280984246911016 );
// console.log(reaction.message.channel.id=='661280984246911016' );
// console.log(reaction.message.channel.id=="661280984246911016" );

	if(reaction.message.channel.id !="661280984246911016"){
		return;
	} 

	if (!user) return;

	if (user.bot) return;

	if (!reaction.message.channel.guild) return;

	for (let n in emojiname) {

		if (reaction.emoji.id == emojiname[n]) {

			reaction.message.guild.member(user).removeRole(rolename[n]).catch(console.error);

		}
	}

});
client.login(token);
