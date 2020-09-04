module.exports = {
    name: 'role',
    description: 'Add, edit or delete role assignemnt messages',
    async execute(message) {
        const Discord = require("discord.js");
        const client = new Discord.Client();

        // Get list of messages from database
        // (if no message exist) return no message exist do you want to create one ?
        // else show list of existing messages

        // Add reactions for add, numbers for each messages from list above
        var numbers = ["1️⃣", "2️⃣", "3️⃣", "4️⃣", "5️⃣", "6️⃣", "7️⃣", "8️⃣", "9️⃣"];
        var messagesList = "➕ Create a new role assignment message";
        var db = require('./../db.js');
        let sql = `SELECT DISTINCT name FROM message
                   ORDER BY name`;
        let i = 0;
        function readDB() {
            return new Promise(function (resolve, reject) {
                db.all(sql, [], (err, rows) => {
                    if (err) {
                        console.log(err);
                    }

                    if (rows.length) {
                        console.log("message table is not empty");
                        rows.forEach((row) => {

                            console.log(row.name);
                            messagesList += "\n" + numbers[i] + " " + row.name;
                            i++;
                        });
                        resolve(messagesList);
                    } else {
                        console.log("message table is empty");
                    }
                });

            })
        }
        //console.log(messagesList);
        async function embedBuilder() {

            var results = await readDB();

            console.log('mL: ' + messagesList);
            const embed = new Discord.MessageEmbed()
                .setColor('#0099ff')
                .setTitle('Use reactions to make your decision')
                .setDescription(messagesList)
                .setTimestamp()
                .setFooter("Requested by " + message.author.username, `https://cdn.discordapp.com/avatars/${message.author.id}/${message.author.avatar}.png`)
                
            return embed

        }
        
        let embededMessage = await message.reply(await embedBuilder()).then(async sentEmbed => {
            //sentEmbed.react("✝️");
            sentEmbed.react("➕");
           
            for (let j = 0; j < i; j++) {
                sentEmbed.react(numbers[j]);
            }


            const filter = (reaction, user) => {
                //return user.id === message.author.id;
                return ["➕", "1️⃣", "2️⃣", "3️⃣", "4️⃣", "5️⃣", "6️⃣", "7️⃣", "8️⃣", "9️⃣"].includes(reaction.emoji.name) && user.id === message.author.id;
            };
            sentEmbed.awaitReactions(filter, { max: 1, time: 100000, errors: ['time'] })
                .then(collected => {
                    const reaction = collected.first();
                    if (reaction.emoji.name === '➕') {
                        sentEmbed.delete();
                        createNew();
                    } else if (numbers.includes(reaction.emoji.name)) {
                        message.reply('you reacted with a  number.');
                    } else {
                        message.reply('you reacted with something else.');
                    }
                })
                .catch(collected => {
                    message.reply('time out.');
                });
                function createNew(){
                    console.log("createNew");
                    message.reply('You selected create a new role assignent menu.\nReact to this message with the emotes you want to add.\nOnce you are done adding the emoji');
                }
            });
       
    },
};