---
title: " Il était une fois Kafka sur Pulsar "
date: 2021-09-24T01:22:36+01:00
draft: false

---

![hbase image](/posts/announcing-kop/images/kop-1.png)

# Abstract

Apache Pulsar est un système de messagerie pub-sub distribué et open source. Il offre de nombreux avantages par rapport à Kafka, tels que le multi-tenant, la géo-réplication, le stockage découplé ou encore le SQL et FaaS directement intégrées. La seule chose qui manque pour une large adoption est le support du standard de-facto pour le streaming: Kafka. Et c'est ainsi que notre histoire commence.

Dans ce talk, nous vous raconterons notre parcours pour construire Kafka On Pulsar. Pour construire notre plateforme de topic managé, nous avions besoin de ce support. On s’est d’abord lancé dans l’écriture d’un proxy en Rust capable de transformer le protocole Kafka vers celui de Pulsar à la volée. Mais lorsque nous avons appris que l’équipe en charge de Pulsar travaillait sur le même sujet, nous avons décidé de les rejoindre 🤝

A la fin de ce talk, vous saurez plus de choses sur le fonctionnement interne de Kafka et de Pulsar. Vous aurez également un retour d’expérience sur l’écriture d’un proxy maison de streaming Rust. Mais surtout sur comment passer d’un développement interne à travailler avec les mainteneurs d’un projet open-source et intégrer la communauté.


# Occurences

* [Devoxx 2021](https://cfp.devoxx.fr/2021/talk/MZF-7892/Il_etait_une_fois_Kafka_sur_Pulsar)

# Ressources

## Slides

{{<gslides link="https://docs.google.com/presentation/d/1oLK5wz3DsYj0dk7_X2dEUqOLRNbk_hY2-HtskxZiYJM" embedded="https://docs.google.com/presentation/d/e/2PACX-1vQhJANmNZmzD1D5zLD0Gr4_ldvGXEB4xc-WyD_gVeAX1huSAumpA923qAgGA2voGi9EY21JPeMk_kh7">}}
