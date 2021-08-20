# Demuxr

## What is Demuxr
Demuxr (http://demuxr.com) is a machine learning app that splits an audio track into its constituent stems. Stems are the individual instrument tracks in a song. Demuxr uses the open source model for music separation Demucs from Facebook AI. 


## Who is Demuxr for?
Demuxr is for anyone who wishes they had a karaoke version of their favorite tracks, not limited to voice karaoke! I use Demuxr to train my bass ear, isolate tricky riffs, and karaoke-jam on my bass and guitar. My friend replaces vocals with his own. His friend listens to isolated drum tracks on loop. Demuxr is for anyone who wants to play around with the music they listen to.

## How do I use it?
1. Find your song on youtube
2. Head to http://demuxr.com 
3. Paste the URL in the box
4. Wait for the model to split the track
5. Adjust the volume for each stem, and seek on the original track
6. Do your thing

## How does it work?
Music separation is trivial... only if you have the original multitrack studio recordings. Even sophisticated (and expensive) software struggles to cleanly isolate a track into its stems.

Enter AI. [Demucs](https://github.com/facebookresearch/demucs) is a model from Facebook AI researchers that has state-of-the-art performance in music splitting. What the model does is detect patterns in sound that correspond to different instruments. This same kind of technology is what Zoom uses to mute out your colleagues' applause. [Read more](https://tech.fb.com/one-track-minds-using-ai-for-music-source-separation/) about Demucs, or play around with the model on their [Colab notebook](https://colab.research.google.com/drive/1jCegIzLIuqqcM85uVs3WCeAJiSoYq3oh?usp=sharing).

Before deploying it on to Demuxr, I made a few changes that result in the model running faster; this optimization is a work-in-progress. Hit me up if you'd like to know more.

## Contributing
There's definitely room to improve, and any contribution - issues, bugs, or code - are welcome! Please reach out or open an issue.

## This takes too long to run, what gives?
The model takes - under ideal conditions - a minute or so to split a 6-minute song. If there's a lot of people running Demuxr at the same time, you're in a queue and that can take a while (depends on how long the queue is). That is not the experience I'd like you to have though, so open an issue while you're waiting (thx).

## The audio split sux, I muted the vocals out but I can still hear them wth?
The model is trained on the [MusDB dataset](https://sigsep.github.io/datasets/musdb.html) that consists of 150 tracks along with their isolated bass, drums, vocals and accompaniment stems. Most of the songs in this dataset are from the Pop/Rock genre. Under/Un-represented genres will be more challenging for the model to demux, and it will resort to what it interprets as various instruments. For example, you might clearly hear the sax and other wind instruments in the demuxed Vocal stem.

![Genres in MusDB](https://i.imgur.com/Zv4R928.png)
