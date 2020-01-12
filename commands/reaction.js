module.exports = {
    name: 'reaction',
    description: 'Ping!',
    execute(message) {
        const Discord = require("discord.js");
        const client = new Discord.Client();
        const m = message.channel.send("Ping?");

        const mc = "661614179358343189";
        const rust = "661613866848878623";
        const lol = "661613866962255873";
        const weed = "661613867033559041";
        const taylor = "246841041678893056";
        const eso = "661618733021790230";
        const halo = "661618733160333333";
        const apex = "661637753196249098";
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
        var rolename = [mcRole, rustRole,lolRole, weedRole, taylorRole,esoRole,haloRole, apexRole, codRole, plexRole];





        client.on('ready', () => {

            console.log(`Logged in as ${client.user.tag}`);

        });







        client.on('message', msg => {



            if (msg.content.startsWith(prefix + "reaction")) {

                if (!msg.channel.guild) return;

                for (let n in emojiname) {

                    var emoji = [msg.guild.emojis.find(r => r.name == emojiname[n])];

                    for (let i in emoji) {

                        msg.react(emoji[i]);

                    }

                }

            }

        });







        client.on("messageReactionAdd", (reaction, user) => {

            if (!user) return;

            if (user.bot) return;

            if (!reaction.message.channel.guild) return;

            for (let n in emojiname) {

                if (reaction.emoji.name == emojiname[n]) {

                    let role = reaction.message.guild.roles.find(r => r.name == rolename[n]);

                    reaction.message.guild.member(user).addRole(role).catch(console.error);

                }

            }

        });





        client.on("messageReactionRemove", (reaction, user) => {

            if (!user) return;

            if (user.bot) return;

            if (!reaction.message.channel.guild) return;

            for (let n in emojiname) {

                if (reaction.emoji.name == emojiname[n]) {

                    let role = reaction.message.guild.roles.find(r => r.name == rolename[n]);

                    reaction.message.guild.member(user).removeRole(role).catch(console.error);

                }

            }

        });
    },
};