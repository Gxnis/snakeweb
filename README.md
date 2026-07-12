# Snake Multiplayer - Jeu de Snake en temps réel (style Slither.io)

Jeu de Snake multijoueur en temps réel avec système de salons publics et privés, hébergable sur Render.

## Fonctionnalités

- **Salons publics** : Rejoignez des salons ouverts à tous
- **Salons privés** : Créez des salons avec un code d'accès unique
- **Multijoueur en temps réel** : Jusqu'à 10 joueurs par salon
- **Gameplay style Slither.io** : Mouvement libre à la souris, orbes à collecter
- **Zone de danger** : Bordures de carte visibles avec timer de 10 secondes
- **Système de drop** : Les serpents laissent leurs orbes quand ils meurent
- **Collision corps-à-corps** : Si la tête touche un autre serpent, mort immédiate
- **Système de score** : Classement en temps réel
- **Design moderne** : Interface utilisateur soignée avec animations

## Technologies

- **Backend** : Node.js, Express, Socket.io
- **Frontend** : React, Socket.io-client, Lucide React (icônes)
- **Déploiement** : Render

## Installation locale

1. Clonez le repository
2. Installez les dépendances :

```bash
npm install
cd client
npm install
cd ..
```

3. Lancez le serveur en développement :

```bash
npm start
cd client
npm start
```

L'application sera accessible sur `http://localhost:3000`

## Déploiement sur Render

### ⚠️ IMPORTANT : Web Service vs Static Site

Pour ce projet, vous devez utiliser un **Web Service** et PAS un Static Site car :

- **Web Service** : Nécessaire car l'application a un backend Node.js avec Socket.io pour le multijoueur en temps réel
- **Static Site** : Ne convient PAS car il ne peut exécuter de code serveur (Node.js, Socket.io)

### Pourquoi Web Service ?

Ce projet nécessite un Web Service car :
- Serveur Node.js avec Socket.io pour les connexions WebSocket
- Game loop côté serveur pour synchroniser les joueurs
- Gestion des salons et états de jeu en temps réel
- Un static site ne peut faire que du HTML/CSS/JS statique sans backend

### Configuration Web Service sur Render

#### Prérequis
- Un compte Render (https://render.com)
- Un repository Git avec ce code

#### Étapes de déploiement

1. **Poussez votre code sur GitHub/GitLab**

2. **Créez un nouveau Web Service sur Render**
   - Allez sur https://dashboard.render.com
   - Cliquez sur "New +" → "Web Service" (PAS "Static Site")
   - Connectez votre repository
   - Configurez les paramètres :
     - **Name** : snake-multiplayer (ou votre choix)
     - **Region** : Choisissez la région la plus proche
     - **Branch** : main (ou votre branche principale)
     - **Runtime** : Node
     - **Build Command** : `npm install && cd client && npm install && npm run build`
     - **Start Command** : `npm start`

3. **Variables d'environnement (optionnelles)**
   - Vous pouvez ajouter des variables d'environnement si nécessaire
   - `PORT` : Render définit automatiquement cette variable

4. **Déployez**
   - Cliquez sur "Create Web Service"
   - Render va construire et déployer votre application
   - Attendez que le déploiement soit terminé (status "Live")

5. **Accédez à votre application**
   - Utilisez l'URL fournie par Render (ex: https://snake-multiplayer.onrender.com)

#### Plan Render recommandé

- **Free Plan** : Convient pour le développement et tests
  - 512 MB RAM
  - CPU partagé
  - L'application s'endort après 15 min d'inactivité
  - Redémarrage en ~30 sec lors de la première requête

- **Starter ($7/mois)** : Recommandé pour production légère
  - 512 MB RAM
  - CPU dédié
  - Pas de mise en veille
  - Temps de réponse plus rapide

- **Standard ($25/mois)** : Pour usage intensif
  - 2 GB RAM
  - Plus de CPU
  - Idéal pour beaucoup de joueurs simultanés

### Configuration

#### Port
Le serveur utilise le port défini par la variable d'environnement `PORT` ou 3001 par défaut. Render définit automatiquement cette variable.

#### Socket.io
Le serveur Socket.io est configuré pour accepter les connexions de n'importe quelle origine (CORS configuré pour '*'). Pour la production, vous pouvez restreindre cela à votre domaine Render dans `server/index.js` :

```javascript
cors: {
  origin: 'https://votre-app.onrender.com',
  methods: ['GET', 'POST']
}
```

## Comment jouer

1. **Créer un salon**
   - Choisissez "Public" pour un salon ouvert à tous
   - Choisissez "Privé" et entrez un code (6 caractères) pour un salon privé
   - Entrez votre pseudo
   - Cliquez sur "Créer le salon"

2. **Rejoindre un salon**
   - Pour un salon public : Sélectionnez un salon dans la liste et cliquez sur "Rejoindre"
   - Pour un salon privé : Entrez le code du salon et cliquez sur "Rejoindre"

3. **Démarrer la partie**
   - Une fois dans le salon, cliquez sur "Démarrer la partie"
   - Tous les joueurs doivent être prêts

4. **Contrôles**
   - **Souris** : Dirigez le serpent en bougeant la souris
   - **Clic gauche** : Boost (accélère)
   - **Orbes** : Mangez les orbes pour grandir
   - **Zone rouge** : Zone de danger - vous avez 10 secondes pour sortir avant de mourir
   - **Autres serpents** : Évitez de toucher le corps des autres serpents

## Structure du projet

```
snake-web/
├── server/
│   └── index.js          # Serveur Node.js avec Socket.io
├── client/
│   ├── public/
│   │   └── index.html
│   ├── src/
│   │   ├── components/
│   │   │   ├── Home.js          # Page d'accueil
│   │   │   ├── GameRoom.js      # Salle de jeu
│   │   │   ├── Home.css
│   │   │   └── GameRoom.css
│   │   ├── App.js
│   │   ├── App.css
│   │   ├── index.js
│   │   └── index.css
│   └── package.json
├── package.json
├── Procfile               # Configuration Render (Web Service)
├── .gitignore
└── README.md
```

## Dépannage

### Le jeu ne se charge pas

- Vérifiez que le serveur est en cours d'exécution
- Vérifiez la console du navigateur pour les erreurs
- Assurez-vous que Socket.io est correctement connecté

### Problèmes de déploiement sur Render

- Vérifiez les logs de déploiement sur le dashboard Render
- Assurez-vous que le build command est correct : `npm install && cd client && npm install && npm run build`
- Vérifiez que le start command est : `npm start`
- Vérifiez que vous avez créé un **Web Service** et non un Static Site

### Les joueurs ne se voient pas

- Vérifiez que tous les joueurs sont dans le même salon (même code)
- Vérifiez que Socket.io est connecté (icone verte dans la console)
- Sur le plan gratuit Render, attendez ~30 sec après inactivité pour le redémarrage

### Application lente sur Render

- Le plan gratuit a des limitations de CPU
- Passez au plan Starter ($7/mois) pour de meilleures performances
- Optimisez le code pour réduire la charge serveur

## License

Ce projet est libre d'utilisation.
