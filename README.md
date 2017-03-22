# opsview-adverts

> A solution to manage adverts for Opsview

#### Lifecycle
1. New advert is added via the web interface which is then uploaded to S3 along with the JSON configuration file.
2. A client will read the JSON file hosted on S3 and based on the current advert rotation be able to derive a link from S3 which will display the link to the image, along with a `redirectUrl` which can be used by the client to direct the user when they interact with the advert.

#### Why use a JSON file instead of a static S3 URL?
- Caching issues are common, especially when dealing with international users who could be served an out of date advert. Instead this solution uses a base64 encoded unique filename to mitigate this issue.
- The JSON file allows us to add conditions to adverts being shown, for example showing certain adverts for certain device types, Opview Monitor versions or being able to gloablly control whether adverts are shown, without a crude solution of removing the assets.

## Install
1. Clone this repo
2. With Node.js (>=6.9.4), npm and [Yarn](https://yarnpkg.com/lang/en/) installed, run `yarn`
3. Make a copy of `.env-sample` called `.env` and add your Amazon AWS credentials in, the credentials must be able to read and write from S3
4. Run `mkdir $PWD/tmp` to create the temporary directory needed for file uploads

## Usage
### Development
```
DATABASE_PATH=$PWD/adverts/adverts.json PORT=8000 yarn start
```

### Production
For production a robust Node.js process management solution should be used; [PM2](https://github.com/Unitech/pm2) is a good start. Then something like NGINX can be used to proxy the requests to `8000` or whatever port is used.
```
DATABASE_PATH=$PWD/adverts/adverts.json PORT=8000 pm2 start server.js --name opsview-adverts --no-vizion
```

> DATABASE_PATH can also be specified in the `.env` file

## Development
- Any changes to the code should follow [Airbnb's JavaScript styleguide](https://github.com/airbnb/javascript), this is enforced with ESLint
- Before commiting, the code should be linted with `yarn run lint` and any errors corrected
- A part of development is ensuring our dependencies are up to date, this can be done with `yarn update-interactive`
