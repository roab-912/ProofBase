# Test « zéro clair »

## Règle et périmètre

Valeurs métier, libellés, noms de colonnes, heure d’événement privée, sels,
K_root/K_data/K_part, passphrases, PRF et récupération ne traversent jamais
la frontière vers API/worker/admin/base/queue/logs. Clés API et credentials
d’infrastructure sont distincts ; ils ne doivent pas non plus être journalisés.
Les paramètres explicitement publics d’une preuve (seuil/périmètre/compte)
sont une divulgation déclarée, exclue des sentinelles secrètes de ce scénario.

## Oracle Phase 0 (exécuté)

`tools/zero-clear.mjs` reçoit des fichiers d’artefacts et des sentinelles dans
le processus de test client, hors de tout app serveur. Il cherche les octets,
hex minuscule/majuscule, base64/base64url, JSON échappé, URL et UTF-16LE.
Fichier manquant/vide/symlink ou catégorie absente => échec fermé. Le message
d’erreur n’affiche que l’index d’artefact, jamais la sentinelle ni son extrait.
`tests/zero-clear.test.mjs` injecte des fuites positives dans chaque catégorie
et vérifie leur détection. Ces fichiers sont synthétiques ; **ce n’est pas
encore un E2E de confidentialité du produit**. Le scanner ne prouve pas l’absence
de toutes les transformations possibles d’une valeur ; les sentinelles et
contrôles de flux se complètent.

## Scénario E2E obligatoire à partir de la Phase 3

1. Dans un processus client séparé, créer coffre et collection avec sentinelles
   aléatoires >=128 bits dans noms/libellés/strings, valeurs numériques uniques,
   passphrase, kit, racine et dérivées. Les clés générées sont capturées par
   l’oracle client seulement. Numériques : rechercher représentations entière,
   biaisée et à échelle fixe avec délimiteurs pour éviter les faux positifs.
2. Avec le SDK réel, envelopper coffre et manifeste, écrire >=100 lignes avec
   padding/rotation, relire/déchiffrer côté client ; comparer les valeurs.
   Exercer retries, idempotence, quota, mauvais ciphertext/AAD, 401/403/409/429/500.
3. Capturer tout HTTP sortant du client vers API/admin/telemetry, y compris
   erreurs. Conserver une allowlist explicite des champs publics ; aucune
   autorisation large sur les corps ou blobs de débogage.
4. Exporter PostgreSQL complet en SQL texte (décoder bytea et couches encodées),
   Redis/queues en JSON décodé, logs stdout/stderr de chaque service, traces,
   dead-letter jobs et fichiers temporaires plateforme. Décompresser avant scan.
   Un collecteur qui échoue, un fichier omis ou un export vide fait échouer le test.
5. Scanner avec l’oracle isolé. Ne jamais transmettre les sentinelles au serveur
   pour lui demander de se scanner. Injecter ensuite une fuite de contrôle dans
   chaque type d’artefact et vérifier que le même pipeline devient rouge.
6. En Phase 5 : ajouter claim/materials/prove local/upload/verify ; scanner
   les témoins, les circuits ne les envoient jamais. En Phase 7 : Playwright
   vérifie réseau, SSR, console, stockage navigateur et verrouillage du coffre.

Les artefacts sensibles restent éphémères et locaux au runner isolé ; ne pas
les uploader dans GitHub Actions, même en cas d’échec. Produire uniquement un
résumé de catégories scannées, nombres, statuts et codes d’erreur non sensibles.
Une CI sans vrai scénario E2E ne pourra pas valider les critères Phase 3/5/7.
