const s3 = require('s3');
const fs = require('fs');
const dotenv = require('dotenv');

dotenv.load();

const client = s3.createClient({
  s3Options: {
    accessKeyId: process.env.AMAZON_ACCESS_KEY,
    secretAccessKey: process.env.AMAZON_SECRET,
  },
});

module.exports = {
  client,
  writeAndUploadFile(
    destinationFilePath,
    localFilePath,
    dataToWriteToFile,
    callback,
    bucket = process.env.BUCKET // eslint-disable-line comma-dangle
  ) {
    if (!destinationFilePath || !localFilePath) {
      throw new Error('Destination path and local path must be specified');
    }

    if (!callback || typeof callback !== 'function') {
      throw new Error('Callback must be a function and be specified');
    }

    if (dataToWriteToFile !== false) {
      fs.writeFileSync(localFilePath, dataToWriteToFile);
    }

    // Start the upload for the database file, it overwrites if it exists
    const uploader = client.uploadFile({
      localFile: localFilePath,
      s3Params: {
        ACL: 'public-read',
        Bucket: bucket,
        Key: destinationFilePath,
      },
    });

    uploader.on('error', error => callback(error));

    uploader.on('end', () => callback(null, true));
  },
  deleteFiles(files, callback, bucket = process.env.BUCKET) {
    if (!Array.isArray(files)) {
      throw new Error('Files must be an array');
    }

    if (files.length === 0) {
      throw new Error('Files array is empty');
    }

    try {
      files.forEach(file => fs.unlinkSync(`${process.env.PWD}/adverts/${file}`));
    } catch (error) {
      console.log(error);
    }

    const deleter = client.deleteObjects({
      Bucket: bucket,
      Delete: {
        Objects: files.map(file => ({
          Key: file,
        })),
      },
    });

    deleter.on('error', error => callback(error));

    deleter.on('end', () => callback(null, true));
  },
  doesFileExist(file, callback, bucket = process.env.BUCKET) {
    if (!file) {
      throw new Error('No file specified');
    }

    client.s3.headObject({
      Bucket: bucket,
      Key: file,
    }, (error) => {
      if (error && error.statusCode === 404) {
        return callback(false);
      }

      return callback(true);
    });
  },
  copy(source, target, callback, bucket = process.env.BUCKET) {
    client.s3.copyObject({
      ACL: 'public-read',
      Bucket: bucket,
      Key: target,
      CopySource: `${bucket}/${source}`,
    }, (error) => {
      if (error) {
        callback(error);
      } else {
        callback(null, true);
      }
    });
  },
  isVersionAbove53(version) {
    const isVersionStringAbove53 = (versionString) => {
      if (versionString === 'all') {
        return false;
      }
      const majorVersion = Number(versionString.split('.')[0]);
      const minorVersion = Number(versionString.split('.')[1]);

      if (majorVersion >= 6 || (majorVersion >= 5 && minorVersion >= 4)) {
        return true;
      }
      return false;
    };

    if (typeof version === 'string') {
      return isVersionStringAbove53(version);
    } else if (Array.isArray(version)) {
      return version.some(isVersionStringAbove53);
    }
    return undefined;
  },
};
