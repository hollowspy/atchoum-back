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


router.get('/products_contentfull', async (req, res, next) => {
     const parseDataFromContentful = (response) => {
        const assetMap = new Map();

        // Construire une map des assets (id → URL)
        response.includes?.Asset?.forEach((asset) => {
            const assetId = asset.sys.id;
            const url = asset.fields.file.url.startsWith('//')
                ? 'https:' + asset.fields.file.url
                : asset.fields.file.url;
            assetMap.set(assetId, url);
        });

        // Transformer les items en format simplifié
        return response.items.map((entry) => {
            const imgId = entry.fields.img?.sys?.id;
            const imageUrl = assetMap.get(imgId) ?? '';

            return {
                id: entry.sys.id,
                name: entry.fields.name,
                brand: entry.fields.brand,
                size: entry.fields.size,
                color: entry.fields.color,
                imageUrl,
            };
        });
    }

    async function getVariationIdForCampaign(visitorId, targetCampaignId) {
         const response = await axios.post(
                'https://decision.flagship.io/v2/ci84rm4uf6t1jrrefeig/campaigns',
                {
                    visitor_id: visitorId,
                    context: {},
                    visitor_consent: true,
                    trigger_hit: true,
                    decision_group: null
                },
                {
                    headers: {
                        'Content-Type': 'application/json',
                        'x-api-key': 'HplFmExQUmlCmSYVSXDWCtfgimmBJeqCfBwOvfCp'
                    }
                }
            );

            const campaigns = response.data.campaigns;

            const campaign = campaigns.find(c => c.id === targetCampaignId);

            if (!campaign) {
               return false;
            }

            const variationId = campaign.variation.id;

            return variationId;
    }

    async function getContentFromFlagshipVariation(variationIdFlagship) {
            // Appel Contentful pour le container
            const contentfulResponse = await axios.get(
                'https://cdn.contentful.com/spaces/st53zti66d9u/environments/master/entries',
                {
                    params: {
                        content_type: 'variationContainer',
                        access_token: 'POgvWhYCAz-KkV9SLtzZK9W6ge3KKw7Lcxl7vQt11Lc',
                        'fields.experimentKey': 'products_page'
                    }
                }
            );
            if (!contentfulResponse.data) {
                throw new Error('no data find in variation container')
            }
            const items = contentfulResponse.data.items;
            const includes = contentfulResponse.data.includes;

            if (!items.length) {
                throw new Error('Aucun container trouvé.');
            }

            const container = items[0];
            const meta = container.fields.meta;

            // Cherche l'ID de la variation Contentful correspondant à l’ID Flagship
            const variationContentfulId = meta[variationIdFlagship];
            if (!variationContentfulId) {
                throw new Error(`Aucune correspondance trouvée dans le meta pour l’ID Flagship ${variationIdFlagship}`);
            }

            // Trouve l'entrée Contentful (pull ou tshirt)
            const entry = includes.Entry.find(e => e.sys.id === variationContentfulId);
            if (!entry) {
                throw new Error(`Aucune entrée trouvée pour l’ID Contentful ${variationContentfulId}`);
            }

            // Récupération de l'image associée
            const assetId = entry.fields.img.sys.id;
            const asset = includes.Asset.find(a => a.sys.id === assetId);
            const imageUrl = asset?.fields?.file?.url
                ? `https:${asset.fields.file.url}`
                : null;

            // Formatage final
            const formatted = {
                name: entry.fields.name,
                brand: entry.fields.brand,
                size: entry.fields.size,
                color: entry.fields.color,
                imageUrl
            };
            console.log('formatted', formatted)

            return formatted;
    }


    try {
        const visitorId = Date.now() + '-' + Math.floor(Math.random() * 10000);
        const idOrigninal = 'd1ilgv373e5iv8esho90';
        const varationFS = await getVariationIdForCampaign(visitorId, "d1ilgv373e5iv8esho80");
        if (!varationFS || (varationFS === idOrigninal)) {
            const urlContentFull = 'https://cdn.contentful.com/spaces/st53zti66d9u/environments/master/entries?access_token=POgvWhYCAz-KkV9SLtzZK9W6ge3KKw7Lcxl7vQt11Lc';
            const response = await axios.get(urlContentFull)
            const formattedRes = parseDataFromContentful(response.data);
            return res.send(formattedRes.filter((res) => res.name))
        }
        const formattedRes = await getContentFromFlagshipVariation(varationFS);
        return res.send([formattedRes])

    } catch (e) {
        return res.status(500).send({
            message: 'Error at get contentfull',
            error: e.message, // ou juste e si tu veux tout
        });
    }
})

module.exports = router;
