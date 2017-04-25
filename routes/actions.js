const express = require('express');
const dotenv = require('dotenv');
const multer = require('multer')({ dest: 'tmp/' });

dotenv.load();

const helpers = require(`${process.env.PWD}/helpers.js`); // eslint-disable-line
const router = express.Router();

router.post('/action', multer.array(), (req, res) => {
  // Derive the adverts status
  const advertsStatus = req.body.toggleAdvertsStatus === 'true';
  const db = require(process.env.DATABASE_PATH); // eslint-disable-line

  db.advertsStatus = advertsStatus;

  const responseData = {
    advertsStatus: db.advertsStatus,
    currentAdvertMobile: db.adverts.find(ad => ad.name === db.currentAdvertMobile),
    currentAdvertDesktop1: db.adverts.find(ad => ad.name === db.currentAdvertDesktop1),
    currentAdvertDesktop2: db.adverts.find(ad => ad.name === db.currentAdvertDesktop2),
    advertsStatusToggled: !db.advertsStatus,
    adverts: db.adverts.reverse(),
    showAdverts: db.adverts.length > 0,
  };

  const uploadDb = () => {
    helpers.writeAndUploadFile('adverts.json', process.env.DATABASE_PATH, JSON.stringify(db), (error) => {
      if (error) {
        return res.render('index', Object.assign({}, responseData, {
          error: `Unable to upload ${process.env.DATABASE_PATH}: ${error.stack}`,
        }));
      }

      return res.render('index', Object.assign({}, responseData, {
        success: `Adverts ${advertsStatus ? 'enabled' : 'disabled'}`,
      }));
    });
  };

  // This code is horrible, but it has to be hacky to support legacy and future adverts versions
  // Rewrite this backend when possible!

  if (advertsStatus) {
    const desktop1IsAbove53 = helpers.isVersionAbove53((
      responseData.currentAdvertDesktop1 &&
      responseData.currentAdvertDesktop1.targetVersion // eslint-disable-line comma-dangle
    ) || '5.4.0');
    const desktop2IsAbove53 = helpers.isVersionAbove53((
      responseData.currentAdvertDesktop2 &&
      responseData.currentAdvertDesktop2.targetVersion // eslint-disable-line comma-dangle
    ) || '5.4.0');

    if (!desktop1IsAbove53 && !desktop2IsAbove53) {
      helpers.copy(responseData.currentAdvertDesktop1.imageFileName, 'opsview-ad-login.png', (error1) => {
        helpers.copy(responseData.currentAdvertDesktop2.imageFileName, 'opsview-ad-reload.png', (error2) => {
          if (!error1 && !error2) {
            return uploadDb();
          }
          uploadDb();
          return res.render('index', Object.assign({}, responseData, {
            error: `Error adding legacy adverts ${error1 && error1.stack} ${error2 && error2.stack}`,
          }));
        });
      });
    } else {
      if (desktop1IsAbove53) { // eslint-disable-line no-lonely-if
        const desktop1Adverts = responseData.adverts.filter(
          ad => helpers.isVersionAbove53(ad.targetVersion) // eslint-disable-line comma-dangle
        );
        const imageName = (desktop1Adverts[0] && desktop1Adverts[0].imageFileName) || false;

        if (!imageName) {
          helpers.copy(responseData.currentAdvertDesktop2.imageFileName, 'opsview-ad-reload.png', (error2) => {
            if (!error2) {
              return uploadDb();
            }
            uploadDb();
            return res.render('index', Object.assign({}, responseData, {
              error: `Error adding legacy adverts ${error2.stack}`,
            }));
          });
        } else {
          helpers.copy(imageName, 'opsview-ad-login.png', (error1) => {
            if (!error1) {
              return uploadDb();
            }

            if (responseData.currentAdvertDesktop2) {
              return helpers.copy(responseData.currentAdvertDesktop2.imageFileName, 'opsview-ad-reload.png', (error2) => {
                if (!error2) {
                  return uploadDb();
                }
                uploadDb();
                return res.render('index', Object.assign({}, responseData, {
                  error: `Error adding legacy adverts ${error2 && error2.stack}`,
                }));
              });
            }
            return uploadDb();
          });
        }
      } else if (desktop2IsAbove53) {
        const desktop2Adverts = responseData.adverts.filter(
          ad => helpers.isVersionAbove53(ad.targetVersion) // eslint-disable-line comma-dangle
        );
        const imageName = (desktop2Adverts[0] && desktop2Adverts[0].imageFileName) || false;

        if (!imageName) {
          helpers.copy(responseData.currentAdvertDesktop1.imageFileName, 'opsview-ad-login.png', (error1) => {
            if (!error1) {
              return uploadDb();
            }
            uploadDb();
            return res.render('index', Object.assign({}, responseData, {
              error: `Error adding legacy adverts ${error1.stack}`,
            }));
          });
        } else {
          helpers.copy(imageName, 'opsview-ad-reload.png', (error1) => {
            if (!error1) {
              return uploadDb();
            }

            if (responseData.currentAdvertDesktop1) {
              return helpers.copy(responseData.currentAdvertDesktop1.imageFileName, 'opsview-ad-login.png', (error2) => {
                if (!error1 && !error2) {
                  return uploadDb();
                }
                uploadDb();
                return res.render('index', Object.assign({}, responseData, {
                  error: `Error adding legacy adverts ${error1 && error1.stack} ${error2 && error2.stack}`,
                }));
              });
            }
            return uploadDb();
          });
        }
      }
    }
  } else {
    helpers.deleteFiles(['opsview-ad-login.png', 'opsview-ad-reload.png'], (error) => {
      if (error) {
        return res.render('index', Object.assign({}, responseData, {
          error: `Error deleting legacy ads from S3 ${error.stack}`,
        }));
      }

      return uploadDb();
    });
  }
});

module.exports = router;
