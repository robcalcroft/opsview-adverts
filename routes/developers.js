const express = require('express');
const dotenv = require('dotenv');

dotenv.load();

const router = express.Router();

router.get('/developers', (req, res) => res.render('developers'));

module.exports = router;
