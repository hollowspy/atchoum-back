var express = require('express');
var router = express.Router();
const pg = require('../bdd/bdd');


router.get('/', (req, res, next) => {
  console.log('in test')
  return res.send({
    success: true
  })
})

router.post('/', async (req, res, next) => {
  const user = {...req.body};
  const queryMail = `SELECT * FROM users WHERE email = '${user.email}'`;
  const userAlreadyRegistered = await pg.query(queryMail);
  if (userAlreadyRegistered.rows.length) {
    const error = new Error('User already registered');
    error.status = 400;
    return next(error);
  }

  const query = `INSERT INTO users (last_name, first_name , email, gender,  height, gift, atchoum_name) VALUES ('${user.lastName}', '${user.firstName}', '${user.email}', '${user.gender}', ${user.height}, '${user.gift}', '${user.atchoumName}')`;
  const insertUser = await pg.query(query);
  if (!insertUser) {
    const error = new Error('Error in insert User');
    error.status = 400;
    return next(error);
  }
  return res.status(202).send({
    success: true
  });
})

module.exports = router;
