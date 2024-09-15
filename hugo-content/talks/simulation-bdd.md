---
title: "Développer des bases de données fiables grâce à la simulation"
date: 2023-06-01T01:22:36+01:00
draft: false
---

Tester la fiabilité d’un logiciel est toujours une chose assez difficile. Malgré tous nos efforts, nous n’arrivons pas à écrire des programmes sans bugs. La raison est assez simple: l’être humain est étonnamment mauvais pour pouvoir imaginer toutes les erreurs possibles qu’un programme peut avoir. Ce constat est encore + vrai quand l'on travaille dans les entrailles des bases de données, où la moindre erreur peut générer de la corruption de données clientes.

Existe-t-il de l'outillage permettant de palier à ce problème ? Une des solutions consiste à venir tout contrôler de façon déterministe: du temps que va prendre l’I/O, au scheduling des threads, en passant par quelle erreur a été déclenché. C’est ce qu’on appelle le Deterministic Simulation Testing. C'est la technique que nous avons choisi afin de pouvoir valider l'implémentation de nos propres bases de données serverless.

Durant ce talk, vous découvrirez les enjeux et les impacts de la simulation dans le cycle de développement d’un logiciel fortement distribué. Vous apprendrez à utiliser notre simulateur open-source. Vous découvrirez également comment Clever Cloud utilise la simulation pour venir accélérer la R&D des futures produits data de l'entreprise.

## Resources

* [Slides](https://docs.google.com/presentation/d/1lrG1a5s7wrEV2i8msHkS11HbiqHyukDe4uUXUwaJ9fI/edit?usp=sharing)

## Occurences

* [Paris Open Source Data Infrastructure Meetup - June 2023](https://www.meetup.com/fr-FR/paris-open-source-data-infrastructure-meetup/events/294037433/)