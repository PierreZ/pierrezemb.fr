+++
title = "Introducing HelloExoWorld: The quest to discover exoplanets with Warp10 and Tensorflow"
date = "2017-10-11T10:23:11.770Z"
[extra]
canonical = "https://medium.com/@PierreZ/engage-maximum-warp-speed-in-time-series-analysis-with-warpscript-c97a9f4a0016"
[taxonomies]
tags= ["nasa", "timeseries", "warp10"]
+++

**update 2019:** this is a repost on my own blog. original article can be read on [medium](https://medium.com/helloexoworld/introducing-helloexoworld-the-quest-to-discover-exoplanets-with-warp10-and-tensorflow-e50f6e669915).

---

![image](/images/introducing-helloexoworld-the-quest-to-discover-exoplanets-with-warp10-and-tensorflow/1.jpeg)
*Artist’s impression of the super-Earth exoplanet LHS 1140b By [ESO/spaceengine.org](https://www.eso.org/public/images/eso1712a/) — [CC BY 4.0](http://creativecommons.org/licenses/by/4.0)*

My passion for programming was kind of late, I typed my first line of code at my engineering school. It then became a **passion**, something I’m willing to do at work, on my free-time, at night or the week-end. But before discovering C and other languages, I had another passion: **astronomy**. Every summer, I was participating at the [**Nuit des Etoiles**](https://www.afastronomie.fr/les-nuits-des-etoiles), a **global french event** organized by numerous clubs of astronomers offering several hundreds (between 300 and 500 depending on the year) of free animation sites for the general public.

![image](/images/introducing-helloexoworld-the-quest-to-discover-exoplanets-with-warp10-and-tensorflow/2.png)
*As you can see below, I was **kind of young at the time**!*

But the sad truth is that I didn’t do any astronomy during my studies. But now, **I want to get back to it and look at the sky again**. There were two obstacles:

* The price of equipments
* The local weather

**I was looking for something that would unit my two passions: computer and astronomy**. So I started googling:

![image](/images/introducing-helloexoworld-the-quest-to-discover-exoplanets-with-warp10-and-tensorflow/3.png)

I found a lot of amazing projects using Raspberry pis, but I didn’t find something that would **motivate me** over the time. So I started typing over keywords, more work-related, such as ***time series*** or ***analytics***. I found many papers related to astrophysics, but there was two keywords that were coming back: **exoplanet detection**.

### What is an exoplanet and how to detect it?

Let’s quote our good old friend [**Wikipedia**](https://en.wikipedia.org/wiki/Exoplanet):
> *An exoplanet or extrasolar planet is a planet outside of our solar system that orbits a star.*

do you know how many exoplanets that have been discovered? [**3,529 confirmed planets** as of 10/09/2017](https://exoplanetarchive.ipac.caltech.edu/). I was amazed by the number of them. I started digging into the [**detection methods**](https://en.wikipedia.org/wiki/Methods_of_detecting_exoplanets). Turns out there is one method heavily used, called **the transit method**. It’s like a eclipse: when the exoplanet is passing in front of the star, the photometry is varying during the transit, as shown below:

![image](/images/introducing-helloexoworld-the-quest-to-discover-exoplanets-with-warp10-and-tensorflow/4.gif)

animation illustrating how a dip in the observed brightness of a star may indicate the presence of an exoplanet. ***Credits: NASA’s Goddard Space Flight Center***

To recap, exoplanet detection using the transit method are in reality a **time series analysis problem**. As I’m starting to be familiar with that type of analytics thanks to my current work at OVH in [**Metrics Data Platform**](https://www.ovh.com/fr/data-platforms/metrics/), I wanted to give it a try.

### Kepler/K2 mission

![image](/images/introducing-helloexoworld-the-quest-to-discover-exoplanets-with-warp10-and-tensorflow/5.jpeg)

*Image Credit: NASA Ames/W. Stenzel*

Kepler is a **space observatory** launched by NASA in March 2009 to **discover Earth-sized planets orbiting other stars**. [The loss of a second of the four reaction wheels during May 2013](https://www.nasa.gov/feature/ames/nasas-k2-mission-the-kepler-space-telescopes-second-chance-to-shine) put an end to the original mission. Fortunately, scientists decided to create an **entirely community-driven mission** called K2, to **reuse the Kepler spacecraft and its assets**. But furthermore, the community is also encouraged to exploit the mission’s unique **open** data archive. Every image taken by the satellite can be **downloaded and analyzed by anyone**.

More information about the telescope itself can be found [**here**](https://keplerscience.arc.nasa.gov/the-kepler-space-telescope.html).

### Where I’m going

The goal of my project is to see if **I can contribute to the exoplanets search** using new tools such as [**Warp10**](http://www.warp10.io) and [**TensorFlow**](https://tensorflow.org/). Using **Deep Learning to search for anomalies could be much more effective** than writing WarpScript, because it is the **neural network&#39;s job to learn** by itself **how** to detect the exoplanets.

As I’m currently following [**Andrew Ng courses about Deep Learning**](https://www.coursera.org/learn/neural-networks-deep-learning), it is also a great opportunity for me to play with **Tensorflow** in a personal project. The project can be divided into several steps:

* **Import** the data
* **Analyze** the data using WarpScript
* **Build** a neural network to search for exoplanets

Let&#39;s see how the import was done!

### Importing Kepler and K2 dataset

#### Step 0: Find the data

As mentioned previously, data are available from The Mikulski Archive for Space Telescopes or [MAST](https://archive.stsci.edu/). It’s a **NASA funded project** to support and provide the astronomical community with a variety of astronomical data archives. Both Kepler and K2 dataset are **available** through **campaigns**. Each campaign has a collection of tar files, which are containing the FITS files associated. A [**FITS**](https://en.wikipedia.org/wiki/FITS) file is an **open format** for images which is also **containing scientific data**.

![image](/images/introducing-helloexoworld-the-quest-to-discover-exoplanets-with-warp10-and-tensorflow/6.png)

*FITS file representation.* [_Image Credit: KEPLER &amp; K2 Science Center_](https://keplerscience.arc.nasa.gov/k2-observing.html)

#### Step 1: ETL (Extract, Transform and Load) into Warp10

To speed-up acquisition, I developed [**kepler-lens**](https://github.com/PierreZ/kepler-lens) to **automatically** **download Kepler/K2 datasets and extract the needed time series** into a CSV format. **Kepler-lens** is using two awesome libraries:

* [**pyKe**](https://github.com/KeplerGO/PyKE) to export the data from the [**FITS**](https://en.wikipedia.org/wiki/FITS) files to CSV ([**#PR69**](https://github.com/KeplerGO/PyKE/pull/69) and [**#PR76**](https://github.com/KeplerGO/PyKE/pull/76)  have been merged).
* [**kplr**](https://github.com/dfm/kplr) is used to **tag** the dataset. With it, I can easily **find stars** with **confirmed** exoplanets or **candidates**.

Then [**Kepler2Warp10**](https://github.com/PierreZ/kepler2warp10) is used to **push the CSV files generated by kepler-lens to Warp10**.

To ease importation, an [**Ansible role**](https://github.com/PierreZ/kepler2warp10-ansible)  has been made, to spread the work across multiples small **virtual machines**.

* **550k distincts stars**
* around **50k datapoints per star**

That&#39;s around **27,5 billions of measures** (300GB of LevelDB files), imported on a **standalone** instance. The Warp10 instance is **self-hosted** on a dedicated [**Kimsufi**](https://www.kimsufi.com/) server at OVH. Here’s the full specifications for the curious ones:

![image](/images/introducing-helloexoworld-the-quest-to-discover-exoplanets-with-warp10-and-tensorflow/7.png)

Now that the data are **available**, we are ready to **dive into the dataset** and **look for exoplanets**! Let&#39;s use WarpScript

!### Let&#39;s see a transit using WarpScript

![image](/images/introducing-helloexoworld-the-quest-to-discover-exoplanets-with-warp10-and-tensorflow/8.png)

WarpScript logo

For those who don’t know WarpScript, I recommend reading my previous blogpost “[**Engage maximum warp speed in time series analysis with WarpScript**](https://medium.com/@PierreZ/engage-maximum-warp-speed-in-time-series-analysis-with-warpscript-c97a9f4a0016)”.

Let’s first plot the data! We are going to take a well-known star called [**Kepler-11**](https://en.wikipedia.org/wiki/Kepler-11). It has (at least) 6 confirmed exoplanets. Let&#39;s write our first WarpScript:

The [FETCH](http://www.warp10.io/reference/functions/function_FETCH) function retrieves **raw datapoints** from Warp10. Let’s plot the result of our script:

![image](/images/introducing-helloexoworld-the-quest-to-discover-exoplanets-with-warp10-and-tensorflow/9.png)

Mmmmh, the straight lines are representing **empties period with no datapoints**; they correspond to **different observations**. **Let&#39;s divide the data** and generate **one time series per observation** using [TIMESPLIT](http://www.warp10.io/reference/functions/function_TIMESPLIT/):

To ease the display, 0 GET is used to **get only the first observation**. Let&#39;s see the result:

![image](/images/introducing-helloexoworld-the-quest-to-discover-exoplanets-with-warp10-and-tensorflow/10.png)

Much better. Do you see the dropouts? **Those are transiting exoplanets!** Now we’ll need to **write a WarpScript to automatically detect transits.** But that was enough for today, so we’ll cover this **in the next blogpost!**Thank you for reading! Feel free to **comment** and to **subscribe** to the [twitter account](https://twitter.com/helloexoworld)!

![image](/images/introducing-helloexoworld-the-quest-to-discover-exoplanets-with-warp10-and-tensorflow/11.jpeg)

**Artist’s impression of the ultracool dwarf star TRAPPIST-1 from close to one of its planets**. Image Credit: By [ESO/M. Kornmesser](http://www.eso.org/public/images/eso1615b/) — [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0)
