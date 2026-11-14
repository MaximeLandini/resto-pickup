# Resto Pickup : mise en service

## 1. Paiement : Stripe (compte RL Concept, versé sur Qonto)
- Fait : branding Resto Pickup, nom public « Resto Pickup », libellé bancaire « RESTO PICKUP », carte, Apple Pay, Google Pay, prélèvement SEPA.
- Automatique : au premier appel, le site crée lui-même les tarifs (repas 11,99 € hebdo et ponctuel, produit Livraison), le webhook `https://restopickup.com/api/webhook` et la configuration du portail client. Rien à saisir dans Stripe.
- Contrôle : se connecter à /admin.html. Un bandeau jaune apparaît seulement s'il manque quelque chose.
- Coût : carte 1,5 % + 0,25 €, prélèvement SEPA 0,35 €, abonnements +0,7 %. Exemple 5 soirs (70,65 €) : 0,84 € en SEPA, 1,80 € en carte.

## 2. E-mails : Brevo (gratuit jusqu'à 300 e-mails par jour)
- Domaine restopickup.com authentifié chez Gandi (enregistrements Brevo), expéditeur bonjour@restopickup.com.
- Alertes équipe (commandes, cartes cadeaux, impayés, demandes et messages de l'espace client, rappels, bugs du site) : maxime@gardenevents.fr et robertlandini@yahoo.fr. Pour changer : variable MAIL_EQUIPE.

## 3. Netlify : variables d'environnement (Projet > Paramètres > Variables)
Indispensables, à coller soi-même (secrets) :
- STRIPE_SECRET_KEY : Stripe > Développeurs > Clés API > Clé secrète (sk_live_…)
- BREVO_API_KEY : Brevo > SMTP et API > Clés API
Facultatives (valeurs par défaut déjà correctes) : SITE_URL, MAIL_FROM, MAIL_EQUIPE, ADMIN_EMAILS, SESSION_SECRET.

## 4. Domaine restopickup.com (Gandi)
Netlify > Domaines : `restopickup.com` (principal), `www.restopickup.com` redirige vers lui.
Chez Gandi, DNS : `A @ 75.2.60.5` et `CNAME www <nom-du-projet>.netlify.app.` Certificat HTTPS automatique.

## 5. Espaces
- Clients : /mon-compte.html (connexion par code e-mail, sans mot de passe)
- Équipe : /admin.html (tableau de bord, tournées, production, clients, messages, demandes, cartes cadeaux)
- Commande au téléphone : /equipe.html (lien de paiement par SMS)

## 6. Mettre à jour le menu
Modifier `menu` dans src/data.json puis pousser sur GitHub : Netlify reconstruit le site tout seul.
