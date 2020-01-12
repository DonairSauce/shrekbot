module.exports = {
	name: 'post',
	description: 'Ping!',
	execute(message) {
        const fetch = require('node-fetch');
        fetch("http://192.168.2.10:3579/api/v1/Request/movie", {
            method: "post",
            headers: {
              'Accept': 'application/json',
              'Content-Type': 'text/json',
              'ApiKey' : '27292d763df6430e966610c99395fbbe'
              
            },
          
            //make sure to serialize your JSON body
            body: JSON.stringify({
                'theMovieDbId': '902',
            })
          })
          .then( (response) => { 
             message.reply("Requested bitch");
          });

	},
};