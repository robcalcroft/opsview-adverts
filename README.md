# opsview-adverts
A solution to manage adverts for Opsview

### Install
1. Clone this repo
2. Install [Node.js](https://nodejs.org/en/) and [yarn](https://yarnpkg.com/en/docs/install)
3. In the project directory, run `yarn` to install dependencies
4. Run `cp .env-sample.json .env.json` to create your environment file and fill out the credentials in there
5. Create a `users.htpasswd` file in the project directory which uses Apache's htpasswd format. You can generate credentials [here](http://www.htaccesstools.com/htpasswd-generator/), or create an MD5 hash of `username:password`.

### Running
- To start the server, run `NODE_ENV=production node server.js`
- To start the rotator, which rotates adverts in the database and on S3 every 48 hours, run `node rotator.js`

**When running in production, use a production grade node process manager like [PM2](http://pm2.keymetrics.io/)**

### Troubleshooting
The logging in both the server and the rotator should give you enough information to debug when things break. Things will often break if there are issues with the S3 upload or if the actions on the website are spammed.

### Issues
Please use the [issues section](https://github.com/robcalcroft/opsview-adverts) to report bugs or request features.
