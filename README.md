# Shrekbot

![Shrekbot Logo](https://upload.wikimedia.org/wikipedia/en/4/4d/Shrek_%28character%29.png)

## Description

Shrekbot is a Discord bot inspired by the lovable ogre himself, Shrek. It allows users to request movies or TV shows to be added to Ombi, a media request platform, using API calls. With Shrekbot, requests can be made directly within the Discord client, making it convenient and fun for users to discover and request their favorite content. Additionally, Shrekbot can notify users when the requested content becomes available to watch, ensuring they never miss out on their favorite shows and movies.

## Features

- **Seamless Requesting**: Users can easily request movies or TV shows to be added to Ombi with simple commands right in the Discord client.
- **Ombi Integration**: Shrekbot uses API calls to communicate with Ombi, ensuring accurate and efficient processing of requests.
- **Notifications**: Shrekbot can notify users when the content they requested becomes available, keeping them updated and ready to watch.
- **Shrek-themed Interface**: Embrace the charm of Shrek with a bot that reflects the spirit of the beloved ogre.

### Configuration

Before running Shrekbot, you need to set the following environment variables:

- `ombitoken`: Secret token of the Ombi server.
- `ombiip`: IP address of the Ombi server.
- `ombiport`: Port number of the Ombi server.
- `clientid`: Discord bot ID.
- `guildid`: Discord server ID.
- `token`: Bot token found on the [Discord Developer Portal](https://discord.com/developers/).
- `channelfeed`: Channel ID used to notify users when content is available.
- `timerexp`: Time (in milliseconds) before a search expires if the user doesn't respond.

You can set these environment variables in your Docker environment or in a `.env` file.


### Running Shrekbot

Once you have set the environment variables, you can run Shrekbot using Docker:

Pull the Docker image from the package repository:
`docker run -d \
  --name shrekbot \
  --env-file .env \
  ghcr.io/donairsauce/shrekbot:master`

Make sure to replace .env with the path to your environment variable file.

## Running Shrekbot without Docker

Please note that these instructions assume you have Node.js and npm installed on your machine. If not, make sure to install them before proceeding.
To run Shrekbot without Docker, you can follow these steps:

1. Clone the repository: 
   ```bash
   git clone https://github.com/donairsauce/Shrekbot.git
   
2. Install the required dependencies. Navigate to the cloned repository's directory:
`cd Shrekbot`
Then, install the dependencies using a package manager such as npm:
`npm install`

3. Set the environment variables: Before running Shrekbot, make sure to set the required environment variables. You can do this by creating a .env file in the root directory of the project and specifying the following variables:

```ombitoken=<Ombi server token>
ombiip=<Ombi server IP>
ombiport=<Ombi server port>
clientid=<Discord bot ID>
guildid=<Discord server ID>
token=<Bot token from Discord Developer Portal>
channelfeed=<Channel ID for notifications>
timerexp=<Time in milliseconds for search expiration>
```
4. Start Shrekbot:
`npm start`

## Usage

To interact with Shrekbot, join a Discord server where the bot is present. Use the following command to initiate a search and request content:

- `/request [query]`: Initiates a search and returns the top ten results in a drop-down list.

Once you enter the `/request` command followed by your query, Shrekbot will perform the search and present the results in a drop-down list. The first result will be automatically selected, and its details, including title, description, release date, and poster, will be displayed.

You can change the selection as many times as you want by using the drop-down list to navigate through the list. When you find the desired content, simply click the "Request" button to submit your request.

Shrekbot will process the request and communicate with Ombi to add the selected content to the media library. You will receive a notification when the requested content becomes available.

### Examples:

- `/request Shrek`: Initiates a search for the movie "Shrek" and presents the results.
- `/request Game of Thrones`: Initiates a search for the TV show "Game of Thrones" and presents the results.

Feel free to explore and request your favorite movies and TV shows with Shrekbot!

## Enabling Notifications in Ombi

To enable notifications for content availability, follow these steps in Ombi:

1. Go to Ombi settings.
2. Select the "Notifications" tab.
3. Under the "Webhook" section, check the "Enabled" checkbox.
4. In the "Base Url" field, enter the location where the bot is hosted, followed by `:8154/webhook`. For example, if the bot is hosted at `http://192.168.1.1`, enter `http://192.168.1.1:8154/webhook`.
5. Save the settings.

By enabling notifications in Ombi and providing the correct base URL, Shrekbot will be able to send notifications to the specified channel when the requested content becomes available to watch.

## Support and Feedback

If you have any questions, need support, or want to provide feedback, you can join our Discord server:

[Join Shrekbot Discord Server](https://discord.gg/Jhr9e9RHwE)

## Contributing

Contributions to Shrekbot are welcome! If you want to contribute to the project, please follow these guidelines:

1. Fork the repository.
2. Create a new branch: `git checkout -b feature/your-feature`.
3. Make your changes and commit them: `git commit -am 'Add your feature'`.
4. Push to the branch: `git push origin feature/your-feature`.
5. Submit a pull request.

## License

This project is licensed by Lord Farquaad.

---

Developed with 💚 for Shrek.
