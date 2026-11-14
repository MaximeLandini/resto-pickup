# Registre des traitements, Resto Pickup

Document interne, à conserver et à tenir à jour. Ne pas publier.

**Responsable du traitement** : R L C RL CONCEPT, EURL, 1 B rue Pierre et Marie Curie, 92140 Clamart, RCS Nanterre 572 136 869, représentée par Roberto Landini, gérant.
**Contact pour les demandes sur les données** : bonjour@restopickup.com, 06 60 68 05 07.
**Mise à jour** : 14 novembre 2026.

## 1. Gestion des commandes et des livraisons
- **Finalité** : livrer les repas, gérer l'abonnement (pause, modification, arrêt), prévenir en cas d'absence.
- **Base légale** : exécution du contrat.
- **Personnes concernées** : clients (payeurs), destinataires des repas.
- **Données** : nom, adresse, téléphone, e-mail, consignes de livraison, formule, jour de livraison, coordonnées du payeur si différent.
- **Destinataires** : équipe Resto Pickup, livreur (adresse, téléphone, consignes seulement).
- **Sous-traitants** : Stripe (stockage des fiches clients et abonnements), Netlify (hébergement, Netlify Blobs).
- **Durée** : durée de l'abonnement, puis 3 ans après la dernière commande.
- **Sécurité** : HTTPS, connexion par code à usage unique, accès équipe nominatif (liste ADMIN_EMAILS), jetons signés.

## 2. Paiement et facturation
- **Finalité** : encaisser les abonnements et cartes cadeaux, émettre les factures, relancer les impayés.
- **Base légale** : exécution du contrat, obligation légale (comptabilité).
- **Données** : montants, factures, statut de paiement. Les numéros de carte et IBAN restent chez Stripe.
- **Sous-traitant** : Stripe Payments Europe (paiement, PCI DSS).
- **Durée** : factures et pièces comptables 10 ans.

## 3. Espace client et messagerie
- **Finalité** : permettre au client de gérer sa commande et d'échanger avec l'équipe.
- **Base légale** : exécution du contrat.
- **Données** : e-mail, code de connexion (15 min), messages, notes internes de l'équipe.
- **Durée** : messages 3 ans après le dernier échange (purge automatique), codes 15 minutes.
- **Règle** : aucune information médicale dans les notes internes ni dans les consignes.

## 4. Demandes de rappel, orientations par des professionnels, demandes de flyers
- **Finalité** : rappeler les personnes qui le demandent, contacter une personne orientée par un professionnel avec son accord, envoyer des flyers.
- **Base légale** : intérêt légitime à répondre à la demande. Orientation : accord de la personne recueilli par le professionnel (case obligatoire), information lors du premier appel.
- **Données** : nom, téléphone, commune, créneau, structure du professionnel.
- **Durée** : 1 an sans commande (purge automatique).

## 5. Cartes cadeaux
- **Finalité** : vendre, envoyer et utiliser les cartes.
- **Base légale** : exécution du contrat.
- **Données** : prénoms acheteur et bénéficiaire, message, e-mail de l'acheteur, code.
- **Durée** : validité (1 an), puis 3 ans.

## 6. E-mails transactionnels et alertes équipe
- **Finalité** : confirmations, codes, accusés de modification, alertes à l'équipe (commandes, demandes, bugs).
- **Base légale** : exécution du contrat, intérêt légitime (suivi de l'activité).
- **Sous-traitant** : Brevo (France), domaine restopickup.com authentifié (DKIM, DMARC).
- **Destinataires des alertes** : maxime@gardenevents.fr, robertlandini@yahoo.fr.
- **Règle** : les alertes contiennent des données clients, ne pas les transférer.

## 7. Sécurité du site
- **Finalité** : détecter et corriger les erreurs.
- **Base légale** : intérêt légitime.
- **Données** : message d'erreur, page, type de navigateur. Pas d'adresse IP conservée.
- **Durée** : 30 jours (purge automatique).

## Droits des personnes
- Demande reçue par mail ou téléphone, réponse sous un mois.
- Effacement : bouton « Effacer les données de ce client » dans la fiche client de l'espace équipe (abonnement arrêté au préalable). Les factures restent conservées.
- Accès ou copie : export de la fiche client et des factures depuis Stripe.

## Transferts hors Union européenne
- Netlify (États-Unis) et Stripe (groupe américain) : transferts encadrés par les garanties prévues par le RGPD. Vérifier une fois par an les accords de traitement (DPA) de chaque prestataire.

## Cookies et traceurs
- Aucun cookie publicitaire ni de mesure d'audience. Stockage local technique uniquement (session, taille du texte) : exempté de consentement.

## Points ouverts
- Désigner un médiateur de la consommation et ajouter ses coordonnées aux CGV (obligation pour toute vente aux consommateurs).
- Faire relire les CGV par un juriste, notamment la clause cartes cadeaux.
- Signer ou accepter en ligne les accords de traitement (DPA) Stripe, Brevo et Netlify, et les classer avec ce registre.
