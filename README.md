# opsview-adverts

> A solution to manage adverts for Opsview

#### Lifecycle
1. New advert is added via the web interface which is then uploaded to S3 along with the JSON configuration file.
2. A client will read the JSON file hosted on S3 and based on the current advert rotation be able to derive a link from S3 which will display the link to the image, along with a `redirectUrl` which can be used by the client to direct the user when they interact with the advert.
3. Every 48 hours the `rotator.js` script is run and updates the current advert with the next one in the list in a cyclic fashion
4. An advert is no longer needed and is deleted using the web ui, the database is updated with these changes and the current advert reset back to the first advert in the list then synced back to S3

#### Why use a JSON file instead of a static S3 URL?
- Caching issues are common, especially when dealing with international users who could be served an out of date advert. Instead this solution uses a base64 encoded unique filename to mitigate this issue.
- The JSON file allows us to add conditions to adverts being shown, for example showing certain adverts for certain device types, Opsview Monitor versions or being able to globally control whether adverts are shown, without a crude solution of removing the assets.

## Install
1. Clone this repo
2. With Node.js (>=6.9.4), npm and [Yarn](https://yarnpkg.com/lang/en/) installed, run `yarn`
3. Make a copy of `.env-sample` called `.env` and add your Amazon AWS credentials in, the credentials must be able to read and write from S3
4. Run `mkdir $PWD/tmp` to create the temporary directory needed for file uploads

## Usage
### Server
#### Development
```
DATABASE_PATH=$PWD/adverts/adverts.json PORT=8000 yarn start-server
```

#### Production
For production a robust Node.js process management solution should be used; [PM2](https://github.com/Unitech/pm2) is a good start. Then something like NGINX can be used to proxy the requests to `8000` or whatever port is used.
```
DATABASE_PATH=$PWD/adverts/adverts.json PORT=8000 pm2 start server.js --name opsview-adverts-server --no-vizion
```

> DATABASE_PATH can also be specified in the `.env` file

### Client
Clients should make a request to `GET https://s3.amazonaws.com/opsview-adverts/adverts.json` to retrieve information about adverts.

#### API
```
{
  // True for global enable, false for global disable
  advertsStatus: Boolean,
  currentAdvertName: '',
  // This could be empty, even if advertsStatus is true
  adverts: [
    {
      // The name of the advert campaign
      name: String,
      // The versions of Opsview to target this advert to
      // ['5.3.0', '5.2.1'] | 'all'
      targetVersion: Array | String,
      // The URL to send users to when they interact with the advert
      redirectUrl: String,
      // A unix timestamp of when the advert was added
      created: Number,
      // The direct URL to load as an image on the client
      s3Url: String,
      // The name of the advert image file
      imageFileName: String,
    }
  ]
}
```

### Rotator
The rotator read the database in every 48 hours, attempts to increment the current advert (it uses the first in the list if it cant find the next one or an empty string for if there are no adverts) then syncs the database back to S3.

#### Development
```
DATABASE_PATH=$PWD/adverts/adverts.json yarn start-rotator
```

#### Production
For production a robust Node.js process management solution should be used; [PM2](https://github.com/Unitech/pm2) is a good start.
```
DATABASE_PATH=$PWD/adverts/adverts.json pm2 start rotator.js --name opsview-adverts-rotator --no-vizion
```

## Development
- Any changes to the code should follow [Airbnb's JavaScript styleguide](https://github.com/airbnb/javascript), this is enforced with ESLint
- Not using Babel so if any ES7+ features don't work in Node use // eslint-disable-line
- Before commiting, the code should be linted with `yarn run lint` and any errors corrected
- A part of development is ensuring our dependencies are up to date, this can be done with `yarn update-interactive`
