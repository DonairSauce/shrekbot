module.exports = {
    name: 'get',
    description: 'get shit',
    execute(message) {
        var request = require("request");

        var options = {
            method: 'GET',
            url: 'https://api.thetvdb.com/search/series',
            qs: { name: 'simpsons' },
            headers:
            {
                'Accept-Language': 'en',
                Authorization: 'Bearer eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJleHAiOjE1NzYyODY2MjQsImlkIjoiMDB6ZSIsIm9yaWdfaWF0IjoxNTc1NjgxODI0LCJ1c2VyaWQiOjIyNDI3MTgsInVzZXJuYW1lIjoiMDB6ZXh5eiJ9.kxa0tZpSOF9EJTe4oxpOK9gBqzYDtpXRVnkaGpQ6SF-BlPfX1VxAGffCMJ3zPtwHMMQ8kC9bx3PgvtQOoFfEnEXcWYE4erDY3kZmmXmK1nDEqdxuagN9h-LEB6WzUpWvKnN7J15qXZzPXRJkSGWHFtk8QgtpI181qnSy3jN5YIGU4qzWN-2BjMPpEqWz0iZ5WAg71-pw9pWoWfQzvkDNN5639sjrbqs8VOurx05pmB7ZNcDc6_3xx_LPDapAwkQqhRFtfZEqyrIocpxsgJm6jkVNfT7nlGAtRZQWdq12nQ7xKDN2OoKh29eGNY3dv-mdEbXPuzmwLUV--1E1Rlu-4g',
                Accept: 'application/json'
            }
        };

        request(options, function (error, response, body) {
            if (error) throw new Error(error);

            console.log(body);
        });

    },
};