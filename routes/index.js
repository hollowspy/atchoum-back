var express = require('express');
var router = express.Router();
const pg = require('../bdd/bdd');
const nodemailer = require('nodemailer');
const hbs = require('nodemailer-express-handlebars');
const path = require('path');
const axios = require('axios');
const findResult = require("../controllers/findResults");
require('dotenv').config();


router.get('/healthz', (req, res, next) => {
    return res.status(200).send('OK')
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
    const date = new Date();
    const query = `INSERT INTO users (last_name, first_name , email, gender,  height, weight, gift, atchoum_name, date) VALUES ('${user.lastName}', '${user.firstName}', '${user.email}', '${user.gender}', ${user.height}, ${user.weight}, '${user.gift}', '${user.atchoumName}', '${date.toISOString()}')`;
    const insertUser = await pg.query(query);
    if (!insertUser) {
        const error = new Error('Error in insert User');
        error.status = 400;
        return next(error);
    }
    res.status(202).send({
        success: true
    });
    const transporter = nodemailer.createTransport(
        {
            service: 'gmail',
            auth:{
                user: process.env.MAIL_USER,
                pass: process.env.MAIL_PASSWORD,
            }
        }
    );

    const handlebarOptions = {
        viewEngine: {
            partialsDir: path.resolve('./views/'),
            defaultLayout: false,
        },
        viewPath: path.resolve('./views/'),
    };
    transporter.use('compile', hbs(handlebarOptions))

    const mailOptions = {
        from: '"Atchoum" <atchoum.niedzwiecki@gmail.com>', // sender address
        to: user.email, // list of receivers
        subject: `Concours d'Atchoum`,
        template: 'email',
        context:{
            firstName: user.firstName,
            lastName: user.lastName,
            gender: (user.gender === 'boy') ? 'garçon' : 'fille',
            height: user.height,
            weight: user.weight,
            atchoumName: user.atchoumName
        },
        attachments: [{
            filename: 'img_atchoum.jpg',
            path: path.join(__dirname, '..', 'public', 'images', 'img_atchoum.jpg'),
            cid: 'img_atchoum'
        }],
    };

    try {
        const response = await transporter.sendMail(mailOptions);
        return response
    } catch (error) {
        console.log(error);
        return next(error)
    }
})


router.post('/result', async (req, res, next) => {
    const user = { ...req.body };

    if (!user.email || user.email.trim() === '') {
        const error = new Error('body is empty or null');
        error.status = 400;
        return next(error);
    }

    try {
        // Requête sécurisée avec variable injectée
        const resultByUser = await pg`
      SELECT * FROM users WHERE email = ${user.email}
    `;

        if (!resultByUser.length) {
            const error = new Error('No user found with this email');
            error.status = 400;
            return next(error);
        }

        res.status(202).send({
            result: resultByUser[0], // Pas de `.rows[0]`, car pg renvoie déjà un tableau JS
        });
    } catch (err) {
        console.error('Erreur dans /result :', err);
        next(err);
    }
})

router.post('/results', async (req, res, next) => {
    try {
        const resultAllUsers = await pg`SELECT * FROM users`;

        if (!resultAllUsers.length) {
            const error = new Error('No results found');
            error.status = 400;
            return next(error);
        }

        res.status(202).send({
            result: resultAllUsers, // direct, c'est un tableau JS
        });
    } catch (err) {
        console.error('Erreur dans /results :', err);
        next(err);
    }
});

router.post('/see_results', async (req, res, next) => {
    try {
        const { id } = req.body;
        console.log('id', id)
        const decisionAPI = await axios.post('https://decision.flagship.io/v2/ci84rm4uf6t1jrrefeig/campaigns', {
            visitor_id: id.toString(),
            context: {},
            visitor_consent: true,
            trigger_hit: true,
            decision_group: null
        }, {
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': 'HplFmExQUmlCmSYVSXDWCtfgimmBJeqCfBwOvfCp'
            }
        });
        console.log('décision API', decisionAPI.data.campaigns[0]);
        if (!decisionAPI.data.campaigns.length) {
            return res.status(200).send({has_access_results_atchoum:false})
        }
        const flagWithValue = decisionAPI.data.campaigns[0].variation.modifications.value;
        return res.status(200).send(flagWithValue);
    } catch (e) {
        console.log('e', e);
        return res.status(400).send(e)
    }

})


router.get('/findResult', findResult)

module.exports = router;
