var express = require('express');
var router = express.Router();
const pg = require('../bdd/bdd');
const nodemailer = require('nodemailer');
const hbs = require('nodemailer-express-handlebars');
const path = require('path')



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
    return res.status(202).send({
        success: true
    });
    const transporter = nodemailer.createTransport(
        {
            service: 'gmail',
            auth:{
                user: 'atchoum.niedzwiecki@gmail.com',
                pass: 'xvrhlrffmasdzqmy'
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

module.exports = router;
