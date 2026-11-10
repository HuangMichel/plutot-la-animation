# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Vite + Three.js (choix de l'utilisateur). Build statique.

## Users

Le jury du hackathon DGE « Gestion des flux touristiques » (Isère). Il découvre le projet en démo, projeté ou parcouru sur un ordinateur, et doit comprendre en deux minutes ses trois volets : l'application visiteur, l'espace gestionnaire et le widget pour les partenaires.

## Product Purpose

Plutôt là répond à une question : « C'est plein ? ». Pour les 2 872 sites touristiques de l'Isère, l'application dit s'il y aura du monde, propose le bon moment, et quand c'est saturé, un coin plus calme à côté avec le chemin. Ce dépôt contient la présentation 3D du projet, pas l'application elle-même.

- Application : https://plutola.hackathon-flux-touristique.vicode.fr/
- Widget (SDK) : https://sdk.hackathon-flux-touristique.vicode.fr/

## Positioning

Au lieu d'afficher seulement une jauge d'affluence, Plutôt là redirige : il nomme l'alternative plus calme, le créneau et l'itinéraire, en tenant compte des besoins de chacun (fauteuil roulant, canne blanche, chien, poussette). Tout se calcule dans le navigateur, sans compte ni serveur.

## Operating Context

- Espace visiteur : chercher un site, répondre à sept questions en images (date, groupe, transport, besoins), lire l'affluence prévue sur quatre niveaux (Calme, Modéré, Chargé, Saturé), voir les alternatives.
- Espace gestionnaire : signaler un site plein en deux gestes, voir les jours qui vont saturer sur deux semaines avec la météo, décrire son lieu, proposer un itinéraire bis.
- Widget : un office de tourisme colle deux lignes de code ; le widget prend les couleurs du site. Trois formes (carte, bandeau, pastille), trois dispositions de carte. Partenaires de démonstration : Alpes Isère, Destination Chartreuse, Grenoble Alpes Tourisme, Pays Voironnais, Société du Lac de Paladru.
- Données : données ouvertes du hackathon (SSP Cloud), écocompteurs de passages, calendrier (vacances, jours fériés), signalements Isère Attractivité. L'affluence est une estimation.

## Capabilities and Constraints

- La présentation se parcourt comme une scène explorable : un diorama 3D qu'on fait tourner, où l'on clique sur les lieux pour découvrir chaque volet (choix de l'utilisateur).
- Elle se joue aussi toute seule : une visite guidée démarre à l'ouverture du livre et enchaîne les étapes, et la molette ou les flèches du clavier avancent d'une étape à la fois (demande de l'utilisateur). Le moindre geste du lecteur met la visite en pause ; elle ne démarre pas seule quand le système demande moins d'animations.
- Lieux réels cités par le produit : Lac de Paladru (Charavines), Fort de la Bastille et téléphérique (Grenoble), lac du Lauvitel (Les Deux Alpes), Chamrousse, La Molière, Théâtre antique (Vienne).
- Exemple de démonstration du produit : Lac de Paladru, samedi 11 juillet 2026 à 15 h, « Très fréquenté », plus calme à partir de 20 h ; alternatives : Base de loisirs O'Lac de Romagnieu (19 km), Étang du Sauget (17 km).

## Brand Commitments

- Nom : Plutôt là. Promesse : « C'est plein ? On vous trouve un coin plus calme, le bon moment et le chemin. »
- Personnages : les Éclaireurs, quatre galets souriants (jaune au chapeau lagon ; lagon foncé à la canne blanche ; corail en fauteuil roulant ; sauge avec un chien guide).
- Couleurs : crème #FEF4E1, encre #0B3540, soleil #FFC941, lagon #2BB0AD, corail #FD795B, sature #E01E1E, nuit #02222B, ciel #CDEBE6.
- Polices : Fredoka (titres), Nunito (texte).
- Ton : tutoiement absent, vouvoiement simple, phrases courtes, pas de jargon.

## Evidence on Hand

- Captures et textes des deux sites (relevés le 10 novembre 2026).
- Aucun témoignage, chiffre d'usage ni partenaire réel : les partenaires sont marqués « démo » et doivent le rester.

## Product Principles

- Rediriger plutôt qu'alerter : chaque constat de saturation vient avec une alternative.
- Dire ce qui est estimé : une prévision déduite est annoncée comme telle.
- Tout le monde compte : les besoins d'accessibilité font partie du parcours principal.
- Rien à installer côté partenaire : deux lignes, aucun compte.

## Accessibility & Inclusion

Le produit met l'accessibilité au centre (cibles larges, contrastes forts, focus visible). La présentation doit rester lisible au clavier, respecter `prefers-reduced-motion` et garder tout son contenu sans WebGL.
