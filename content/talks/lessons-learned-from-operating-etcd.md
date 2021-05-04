---
title: "Lessons Learned from Operating ETCD"
date: 2021-05-02T01:22:36+01:00
draft: false
---

# Abstract

OVHcloud is the biggest European cloud provider. From dedicated servers to Managed Kubernetes, from VMware® based Hosted Private Cloud to OpenStack-based Public Cloud, we have over 1.4 million customers worldwide. Because of our Kubinception design(using Kubernetes to run Kubernetes), we are putting hundreds of customers in an ETCD cluster. This design is great to easily spawn control-planes for customers, but it is also putting a lot of pressure on ETCD. To keep it healthy while growing up constantly, we had to learn many things about how ETCD works under the hood and how we can operate it efficiently. 

In this talk, you will have the insights of how we are operating our ETCD clusters. We will tell you our journey to use ETCD, from our observability to deployments and management, what did work and what did not. 

# Occurences

* [KubeCon Europe 2021](https://kccnceu2021.sched.com/event/iE5K/lessons-learned-from-operating-etcd-pierre-zemb-ovhcloud)

# Ressources


## Slides

{{<gslides link="https://docs.google.com/presentation/d/1uOpawkCoqPQuxD5MuEhXeCrJV1Nw9fopUBq2IRTvwcI/edit?usp=sharing" embedded="https://docs.google.com/presentation/d/e/2PACX-1vQYNwMYLlNb4LjblfrbYyspIBuGTb8tKcBu9yTBaRr8vzs8A-5pde4yHsq0cY5A14o_L8mcq8zdmf7A">}}

## Videos

TBD 

# Photos and tweets

{{<tweet 1389541817004134404>}}
