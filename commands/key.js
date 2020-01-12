module.exports = {
    name: 'key',
    description: 'Retreives key for TVDB',
    async execute() {
        var tokenExpireMs = 86400000;
        const fetch = require('node-fetch');
        var date = Date.now();
        //var jwtTok;
        var tokenObj = new Object(),
            jwtToken,
            dateTime;

            if (tokenObj.jwtToken == undefined || tokenObj.jwtToken == null || date > (tokenObj.dateTime + tokenExpireMs)){
                const result = await fetch('https://api.thetvdb.com/login', {
                    method: 'post',
                    headers: {
                        'Accept': 'application/json',
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        "apikey": "f3b5d18449df77a9f74be7a5564961de",
                        "userkey": "5DEAF65C114690.03812018",
                        "username": "00zexyz"
                    })
                }).then(res => res.json());
                    //.then(json => jwtTok = json);
                    //console.log(jwtTok);
                    
                    tokenObj.jwtToken = result.token;
                    tokenObj.dateTime =
                    console.log('====');
                    console.log(tokenObj.jwtToken);
            }


        }
        
  
};
        // if (tokenObj.jwtToken == undefined || tokenObj.jwtToken == null || date > (tokenObj.dateTime + tokenExpireMs)) {
        //     refreshToken();
        //     console.log("2:" + Object.values(tokenObj));
        // }

        // console.log("3:" + Object.values(tokenObj));



        // (async () => {
        //     const rawResponse = await fetch('https://api.thetvdb.com/login', {
        //         method: 'POST',
        //         headers: {
        //             'Accept': 'application/json',
        //             'Content-Type': 'application/json'
        //         },
        //         body: JSON.stringify({
        //             "apikey": "f3b5d18449df77a9f74be7a5564961de",
        //             "userkey": "5DEAF65C114690.03812018",
        //             "username": "00zexyz"
        //         })
        //     });
        //     const content = await rawResponse.json();
        //     tokenObj.jwtToken = content.token;

        //     tokenObj.datetTime = date;
        //     console.log("5:"+Object.values(tokenObj));

        // })();
        // console.log("1:"+Object.values(tokenObj));
        // return tokenObj.jwtToken;