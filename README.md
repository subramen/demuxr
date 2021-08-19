# Demuxr

## What is Demuxr
Demuxr (http://demuxr.com) is a machine learning app that splits an audio track into its constituent stems. Stems are the individual instrument tracks in a song. Demuxr uses the open source model for music separation Demucs from Facebook AI. 


## Who is Demuxr for?
Demuxr is for anyone who wishes they had a karaoke version of their favorite tracks, not limited to voice karaoke! I use Demuxr to train my bass ear, isolate tricky riffs, and karaoke-jam on my bass and guitar. My friend replaces vocals with his own. His friend listens to isolated drum tracks on loop because he's a bit crazy like that. Demuxr is for anyone who wants to play around with the music they listen to.

## How do I use it?
1. Find your song on youtube.
2. Paste the URL in the box.
3. Wait for the model to split the track.
4. Adjust the volume for each stem, and seek on the original track.
5. Do your thing.
6. Profit

## How does it work?
Music separation is trivial... only if you have the original multitrack studio recordings. Even sophisticated (and expensive) software struggles to cleanly isolate a track into its stems.

Enter AI. Demucs is a model from Facebook AI researchers that has state-of-the-art performance in music splitting. What the model does is detect patterns in sound that correspond to different instruments. This same kind of technology is what Zoom uses to mute out your colleagues' applause, or better noise-cancelling headphones.

I tweaked the model a bit before I deployed to make it run faster. Hit me up if you'd like to know what changes I made.

## This takes too long to run, what gives?
The model takes - under ideal conditions - a minute or so to split a 6-minute song. If there's a lot of people running Demuxr at the same time, you're in a queue and that can take a while (depends on how long the queue is). That is not the experience I'd like you to have though, so open an issue and I'll investigate.

## The audio split sux, I muted the vocals out but I can still hear them. What gives?
"Leaking" can occur because ML, as awesome as it is, still has its limitations. It can be frustrating to be subject to a singer you aren't particularly fond of, but rest assured that researchers are hard at work and we will soon\* have a perfect music splitting model.

## Contributing
There's definitely room to improve, and any contribution will make a difference. Maybe we should optimize the ML model, enhance the UX by making this a chrome plugin,  or <your awesome idea here>... please open an issue if you'd like to work on something. Please also open an issue if you encounter a bug. Thank you for even considering it!