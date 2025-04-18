const pg = require("../bdd/bdd");


const findResult = async (req, res, next) => {
    const responses = await pg`SELECT * FROM users`;

    // Gender
    const definitiveGender = 'girl';
    const atchoumWeight = 3840;
    const atchoumHeight = 53;


    const intervalWeightBasePoint = 50;
    const intervalWeightPoints = 10;

    const intervalHeight = 1;
    const intervalHeightPoints = 40;



    const responseByGender = responses.rows.filter(d => d.gender === definitiveGender);


    const definitiveResponse = responseByGender.map((r) => {

        // Weight
        const weightInGrms = r.weight * 1000;
        const diffWeight = Math.abs(atchoumWeight - weightInGrms);
        const intervalWeight = Math.round(diffWeight / intervalWeightBasePoint);
        const weightPoints = intervalWeight * intervalWeightPoints;


        //height
        const diffHeight = Math.abs(r.height - atchoumHeight);
        const heightPoints = Math.round(diffHeight * intervalHeightPoints);

        const finalWeight = (200 - weightPoints < 0 ? 0 : 200 - weightPoints) ;
        const finalHeight = (200 - heightPoints < 0 ? 0 : 200 - heightPoints);
        const finalResult = finalWeight + finalHeight;



        return {
            ...r,
            weightInGrms,
            diffWeight,
            weightPoints,
            definitiveWeightPoints: finalWeight,
            definitiveHeightPoints: finalHeight,
            definitiveResult : finalResult
        }
    });

    const sortResult = definitiveResponse.sort((a, b) => {
        return b.definitiveResult - a.definitiveResult
    });
    console.log('sortResult', sortResult);
    return res.send(sortResult);
};

module.exports = findResult;