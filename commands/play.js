const { Util } = require("discord.js");
const fs = require('fs');
const ytdl = require("ytdl-core");
const ytdlDiscord = require("discord-ytdl-core");
module.exports = {
  name: "play",
  description: "Play a song in your channel!",
  async execute(message) {
    try {
      
      const args = message.content.split(" ");
      const queue = message.client.queue;
      console.log("q:" + queue);
      console.log("server id:"+message.guild.id);
      
      const serverQueue = message.client.queue.get(message.guild.id);
      //const serverQueue = message.client.queue.get(message.guild.id);
      console.log("serverQueue:" + serverQueue);
      const voiceChannel = message.member.voice.channel;
      console.log("vc:" + voiceChannel);
      if (!voiceChannel)
        return message.channel.send(
          "You need to be in a voice channel to play music!"
        );
      const permissions = voiceChannel.permissionsFor(message.client.user);
      if (!permissions.has("CONNECT") || !permissions.has("SPEAK")) {
        return message.channel.send(
          "I need the permissions to join and speak in your voice channel!"
        );
      }
      
      const songInfo = await ytdl.getInfo(args[1]);
      const song = {
        title: songInfo.title,
        url: songInfo.video_url
      };
    
      if (!serverQueue) {
        console.log("!serverQueue")
        const queueContruct = {
          textChannel: message.channel,
          voiceChannel: voiceChannel,
          connection: null,
          songs: [],
          volume: 5,
          playing: true
        };
        queue.set(message.guild.id, queueContruct);
        queueContruct.songs.push(song);
        try {
          var connection = await message.member.voice.channel.join();
          console.log("the connection: "+connection);
          queueContruct.connection = connection;
          this.play(message, queueContruct.songs[0],queueContruct.connection );
        } catch (err) {
          console.log(err);
          queue.delete(message.guild.id);
          return message.channel.send(err);
        }
      } else {
        serverQueue.songs.push(song);
        return message.channel.send(
          `${song.title} has been added to the queue!`
        );
      }
    } catch (error) {
      console.log(error);
      message.channel.send(error.message);
    }
  },

  async play(message, song) {
  
    //const queue = message.client.queue;
    const guild = message.guild;
    const serverQueue = message.client.queue.get(message.guild.id);
    //const serverQueue = message.client.queue.get(message.guild.id);

    if (!song) {
      serverQueue.voiceChannel.leave();
      queue.delete(guild.id);
      return;
    }
    console.log(song);
    console.log("connection: "+serverQueue.connection.id);
    const dispatcher = serverQueue.connection.play(ytdl(song.url, { fliter: "audioonly" }))
      .on("end", () => {
        console.log("Music ended!");
        serverQueue.songs.shift();
        this.play(message, serverQueue.songs[0]);
      })
      .on("error", error => {
        console.error(error);
      });
    dispatcher.setVolumeLogarithmic(serverQueue.volume / 5);
  }
};