# Resto Pickup : mise en service

## 1. Paiement : Stripe, versé sur le compte Qonto
- Créer le compte Stripe au nom de R L C RL CONCEPT, IBAN de versement : le compte Qonto.
- Paramètres > Moyens de paiement : activer Carte, Apple Pay, Google Pay, Prélèvement SEPA.
- Catalogue de produits :
  - « Repas Resto Pickup » : prix récurrent hebdomadaire 11,99 € TTC → identifiant `price_…` = STRIPE_PRICE_REPAS
  - même produit, prix ponctuel 11,99 € TTC → STRIPE_PRICE_REPAS_UNIQUE (semaine d'essai)
  - produit « Livraison » (sans prix) → identifiant `prod_…` = STRIPE_PRODUCT_LIVRAISON
- Portail client (Paramètres > Billing > Portail client) : autoriser factures, moyen de paiement, résiliation.
- Développeurs > Webhooks > Ajouter : URL `https://restopickup.com/api/webhook`, événements
  `checkout.session.completed`, `invoice.payment_failed`, `customer.subscription.deleted` → STRIPE_WEBHOOK_SECRET
- Coût : carte 1,5 % + 0,25 €, prélèvement SEPA 0,35 €, abonnements +0,7 %. Exemple 5 soirs (70,65 €) : 0,84 € en SEPA, 1,80 € en carte.

## 2. E-mails : Brevo (gratuit jusqu'à 300 e-mails par jour)
- Créer le compte, valider le domaine restopickup.com (enregistrements DNS donnés par Brevo, à ajouter chez Gandi).
- Clé API → BREVO_API_KEY ; MAIL_FROM = bonjour@restopickup.com ; MAIL_EQUIPE = adresse qui reçoit commandes, messages et rappels.

## 3. Netlify : variables d'environnement (Projet > Paramètres > Variables)
STRIPE_SECRET_KEY, STRIPE_PRICE_REPAS, STRIPE_PRICE_REPAS_UNIQUE, STRIPE_PRODUCT_LIVRAISON, STRIPE_WEBHOOK_SECRET,
BREVO_API_KEY, MAIL_FROM, MAIL_EQUIPE, SITE_URL=https://restopickup.com,
SESSION_SECRET (longue chaîne aléatoire), ADMIN_KEY (12 caractères minimum, outil téléphone),
ADMIN_EMAILS (e-mails autorisés dans l'espace admin, séparés par des virgules).

## 4. Domaine restopickup.com (Gandi)
Netlify > Domaines : ajouter `restopickup.com` (principal) et `restopickup.com`.
Chez Gandi, DNS : `A @ 75.2.60.5` et `CNAME www <nom-du-projet>.netlify.app.` Certificat HTTPS automatique.

## 5. Espaces
- Clients : /mon-compte.html (connexion par code e-mail, sans mot de passe)
- Équipe : /admin.html (tableau de bord, tournées, production, clients, messages, demandes, cartes cadeaux)
- Commande au téléphone : /equipe.html (lien de paiement par SMS)

## 6. Mettre à jour le menu
Modifier `menu` dans src/data.json puis pousser sur GitHub : Netlify reconstruit le site tout seul.
