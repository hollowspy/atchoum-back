var express = require('express');
var router = express.Router();
const pg = require('../bdd/bdd');
const nodemailer = require('nodemailer');
const hbs = require('nodemailer-express-handlebars');
const path = require('path');
const findResult = require("../controllers/findResults");
require('dotenv').config();

var contentful = require('contentful')

const { Flagship, DecisionMode} = require('@flagship.io/js-sdk');

Flagship.start(
    'ci84rm4uf6t1jrrefeig',
    'HplFmExQUmlCmSYVSXDWCtfgimmBJeqCfBwOvfCp',
    {
        decisionMode: DecisionMode.DECISION_API,
        fetchNow: false
    }
)

async function getFlagValue(fsVisitor, flagKey, defaultValue = null) {
    const flag = fsVisitor.getFlag(flagKey);
    return flag.getValue(defaultValue);
}


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
        const FLAG_KEY = 'has_access_results_atchoum';
        const visitor = await Flagship.newVisitor(
            {
                visitorId: String(id),
                context: {},
                hasConsented: true
            }
        );

        await visitor.fetchFlags();

        const value = await getFlagValue(visitor, FLAG_KEY, { has_access_results_atchoum: false });

        return res.status(200).send({ [FLAG_KEY]: Boolean(value) });
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

    function resolveEntryFromContainer(container, includes, variationIdFlagship) {
        const meta = container.fields.meta;
        if (!meta) throw new Error('Container meta manquant.');
        const variationContentfulId = meta?.[variationIdFlagship];
        if (!variationContentfulId) {
            throw new Error(`Pas de correspondance meta pour variationId=${variationIdFlagship}`);
        }

        const entry = includes.Entry?.find(e => e.sys.id === variationContentfulId);
        if (!entry) throw new Error(`Entry introuvable pour id=${variationContentfulId}`);

        const assetId = entry.fields.img?.sys?.id;
        const asset = includes.Asset?.find(a => a.sys.id === assetId);
        const imageUrl = asset?.fields?.file?.url ? `https:${asset.fields.file.url}` : null;

        return {
            id: entry.sys.id,
            name: entry.fields.name,
            brand: entry.fields.brand,
            size: entry.fields.size,
            color: entry.fields.color,
            imageUrl
        };
    }

    async function getVariationForCampaign(visitor, campaignId) {
        if (!campaignId) {
            throw new Error('getVariationForCampaign: campaignId requis');
        }

        // fetch the flags
        await visitor.fetchFlags();

        // get the metadatas from the visitor
        const flags = await visitor.getFlags();
        const metaMap = await flags.getMetadata(); // Map
        if (!metaMap || typeof metaMap[Symbol.iterator] !== 'function') {
            throw new Error('getVariationForCampaign: Map de métadatas vide');
        }

        // Map the map to retrieve the right camapigId and variationId
        for (const [flagKey, meta] of metaMap.entries()) {
            if (!meta) continue;
            if (meta.campaignId !== campaignId) continue;

            return {
                variationId: meta.variationId,
                flagKeyMatched: flagKey,
                metadata: meta,
            };
        }

        throw new Error(`getVariationForCampaign: aucune metadata pour campaignId=${campaignId}`);
    }

    function getVariationIdFromMetadata(campaignId, metadatas) {
        if (!campaignId || !Array.isArray(metadatas)) {
            return null;
        }

        for (const [key, metadata] of metadatas) {
            if (metadata && metadata.campaignId === campaignId) {
                return metadata.variationId;
            }
        }

        return null;
    }

    try {

        const visitorId = Date.now() + '-' + Math.floor(Math.random() * 10000);

        // initialize Contentful SDK
        const client = contentful.createClient({
            space: process.env.CTF_SPACE_ID || 'st53zti66d9u',
            accessToken: process.env.CTF_CDA_TOKEN || 'POgvWhYCAz-KkV9SLtzZK9W6ge3KKw7Lcxl7vQt11Lc',
        });

        // retrieve the container entry with content type id
        const containerResp = await client.getEntries({
            content_type: 'abTastyContainer',
            limit: 1,
            include: 2,
        });

        if (!containerResp.items?.length) {
            throw new Error('No abTastyContainer found in Contentful.');
        }

        // get the first item from the container
        const container = containerResp.items[0];


        const campaignId = container.fields.experimentID;

        // get the includes from the response
        const includes = containerResp.includes || {};

        // 2) create a new visitor with the visitorId
        const visitor = await Flagship.newVisitor({
            visitorId: String(visitorId),
            context: {},
            hasConsented: true
        });

        const { variationId } = await getVariationForCampaign(visitor, campaignId);

        // 3) Si pas de variation, retourner une liste de fallback depuis Contentful (SDK)
        if (!variationId) {
            const listResp = await client.getEntries({ include: 2, limit: 50 });
            const simplified = parseDataFromContentful(listResp).filter(e => e.name);
            return res.status(200).send(simplified);
        }

        // 4) S'il y a une variation, résoudre l'entry ciblée par le container
        const formattedRes = resolveEntryFromContainer(container, includes, variationId);
        return res.status(200).send([formattedRes]);

    } catch (e) {
        return res.status(500).send({
            message: 'Error at get contentfull',
            error: e.message,
        });
    }
})

module.exports = router;
