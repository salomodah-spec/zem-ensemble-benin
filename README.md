# Configuration Firebase

1. Créez un projet dans https://console.firebase.google.com/.
2. Ajoutez une application Web et copiez sa configuration dans `www/app.js` à la place des valeurs `REMPLACER_...`.
3. Dans Authentication > Sign-in method, activez **Anonymous** et **Email/Password**.
4. Créez une base Firestore en mode production.
5. Publiez les règles du fichier `firestore.rules` depuis la console ou avec Firebase CLI.
6. Pour un vrai compte administrateur, attribuez le custom claim `admin: true` au compte depuis un environnement Admin SDK de confiance. Ne mettez jamais une clé de service Admin SDK dans l'application mobile.

Attention : cette première version utilise l'authentification anonyme pour les passagers et une authentification email/mot de passe pour l'administration. Les règles empêchent un utilisateur ordinaire de s'attribuer le rôle admin. Les demandes de places sont enregistrées dans `trips/{tripId}/riders/{uid}`.
