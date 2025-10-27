# atchoum-back

## Decide on a variation with Flagship

Objectif: décider d’une variation (A/B test) pour un visiteur avec le SDK Flagship (AB Tasty).

Prérequis:
- Variables d’environnement: FLAGSHIP_ENV_ID, FLAGSHIP_API_KEY
- Node.js + package @flagship.io/js-sdk

Étapes:
1) Démarrer le SDK
2) Créer un visitor avec un visitorId
3) fetchFlags()
4) Lire la valeur du flag ou l’ID de variation

Exemple minimal:
